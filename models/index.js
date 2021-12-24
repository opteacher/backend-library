import _ from "lodash";
import Router from "koa-router";
import Path from "path";
import * as utils from "../utils/index.js";
import { getDbByName } from '../databases/index.js';

const router = new Router();

export async function genMdlRoutes(mdlsPath, dbCfgPath, mdlCfgPath) {
    const cfg = utils.readConfig(mdlCfgPath);
    const db = await getDbByName(cfg.type, dbCfgPath);

    // @block{modelRoutes}:模型生成路由
    // @includes:lodash
    // @includes:koa-router
    // @includes:../db/数据库类型
    // @includes:../config/model.json

    // @steps{1}:引进所有模型
    const models = [];
    for (const mfile of utils.scanPath(mdlsPath, { ignores: ["index.js"] })) {
        models.push((await import (Path.resolve(mdlsPath, mfile))).default);
    }

    // @step{}:同步数据库
    const syncFunc = async() => {
        if (cfg.sync && Array.isArray(cfg.sync)) {
            await Promise.all(cfg.sync.map((tname) => db.sync(models.find(model => model.name === tname).model)));
            console.log("数据库模型同步完毕");
        } else if (cfg.sync) {
            await Promise.all(_.values(models).map((minfo) => db.sync(minfo.model)));
            console.log("数据库模型同步完毕");
        }
        if (cfg.inits) {
            for (const [mname, initFile] of cfg.inits) {
                const numIpt = await db.dump(models.find(model => model.name === mname).model, Path.resolve(initFile));
                console.log(
                    `从${initFile}文件内读取并导入了${numIpt}条记录到表${mname}中`
                );
            }
        }
    };
    syncFunc();

    // @steps{2}:根据模型之间的关系，生成前置路径
    db.genPreRoutes();

    // @steps{3}:遍历所有模型
    console.log("模型生成的路由：");
    const mdlRoutes = [];
    for (const minfo of models) {
        // @steps{3_2}:定义所有用到的URL
        const GetUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}/:index`;
        const AllUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}s`;
        const PostUrl = `/${cfg.prefix}/mdl/v${cfg.version}/${minfo.name}`;
        const PutUrl = GetUrl;
        const DelUrl = GetUrl;
        const prePath = minfo.options.router.prePath;
        const LnkUrl = prePath ?
            `/${cfg.prefix}/mdl/v${cfg.version}/${prePath
          .map((pp) => pp[1])
          .join("/")}/${minfo.name}/:index` :
            null;

        // @steps{3_3}:遍历用户要求的method接口
        for (const method of minfo.options.router.methods) {
            // @steps{3_3_2}:根据method跳转到相应的处理逻辑中
            let path = "";
            let params = [];
            switch (method.toLowerCase()) {
                case "get":
                    // @steps{3_3_2_1}:*GET*：根据id查找，**会联表**
                    router.get(GetUrl, async(ctx) => {
                        ctx.body = {
                            data: (
                                await db.select(
                                    minfo, { _index: ctx.params.index }, { ext: true }
                                )
                            )[0],
                        };
                    });
                    path = GetUrl;
                    console.log(`GET\t${GetUrl}`);
                    break;
                case "all":
                    // @steps{3_3_2_2}:*ALL*：查所有，**不会联表**
                    router.get(AllUrl, async(ctx) => {
                        ctx.body = {
                            data: await db.select(minfo, ctx.query),
                        };
                    });
                    path = AllUrl;
                    params.push({ order_by: "Prop Name" }, { limit: "Number" }, { page: "Number" });
                    console.log(`GET\t${AllUrl}`);
                    break;
                case "post":
                    // @steps{3_3_2_3}:*POST*：**使用form表单提交**
                    router.post(PostUrl, async(ctx) => {
                        ctx.body = {
                            data: (await db.save(minfo, ctx.request.body))[0],
                        };
                    });
                    console.log(`POST\t${PostUrl}`);
                    break;
                case "put":
                    // @steps{3_3_2_4}:*PUT*：同POST
                    router.put(PutUrl, async(ctx) => {
                        ctx.body = {
                            data: (
                                await db.save(minfo, ctx.request.body, {
                                    _index: ctx.params.index,
                                })
                            )[0],
                        };
                    });
                    path = PutUrl;
                    params.push({
                        need_update_prop: "value",
                    });
                    console.log(`PUT\t${PutUrl}`);
                    break;
                case "delete":
                    // @steps{3_3_2_5}:*DELETE*：同GET
                    router.delete(DelUrl, async(ctx) => {
                        ctx.body = {
                            data: await db.delete(minfo, {
                                _index: ctx.params.index,
                            }),
                        };
                    });
                    path = DelUrl;
                    console.log(`DELETE\t${DelUrl}`);
                    break;
                case "link":
                    // @steps{3_3_2_6}:*LINK*：将对象关联到指定目标对象中（**对象已经被创建**）
                    //             ```
                    //             /mdl/vx/target/:tid/source/:sid
                    //             // 意味着source[sid]关联到target[tid]
                    //             ```
                    if (!LnkUrl || !prePath) {
                        break;
                    }
                    router.put(LnkUrl, async(ctx) => {
                        const lstPre = prePath[prePath.length - 1];
                        const prop = lstPre[0];
                        const path = lstPre[1];
                        const ary = path.split("/");
                        if (ary.length !== 2) {
                            ctx.body = "错误的路由前缀";
                            return;
                        }
                        const colNam = ary[0];
                        const pamIdx = ary[1].slice(1);
                        const preMdl = models[colNam];
                        const condition = { _index: ctx.params[pamIdx] };
                        ctx.body = {
                            data: await db.save(
                                preMdl, {
                                    [prop]: ctx.params.index,
                                },
                                condition, {
                                    updMode: "append",
                                }
                            ),
                        };
                    });
                    path = LnkUrl;
                    console.log(`LINK\t${LnkUrl}`);
                    break;
            }
            mdlRoutes.push({
                path,
                method,
                params,
            });
        }
    }
    router.get(`/${cfg.prefix}/mdl/v${cfg.version}/model`, async(ctx) => {
        ctx.body = { version: cfg.version, routes: mdlRoutes };
    });
    console.log(`GET\t/${cfg.prefix}/mdl/v${cfg.version}/model`);
    return { router, models, db };
}
