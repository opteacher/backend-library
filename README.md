# backend-library

后台自用库，包含统一的数据库接口、模型路由、文件夹路由等。

## 安装方法

1. 【submodule 方式，也可 clone 下来】添加库

```
mkdir lib && cd lib
git submodule add git@gitlab.com:opteacher/backend-library.git
```

2. 修改 package.json

- 添加依赖：

```json
"dependencies": {
  "koa-router": "^10.0.0",
  "lodash": "^4.17.21",
  "mongoose": "^6.1.2",
  "mysql2": "^2.2.5",
  "sequelize": "^4.38.0",
  "toml": "^3.0.0"
},
"devDependencies": {
  "@types/koa-router": "^7.4.4",
  "@types/lodash": "^4.14.178",
  "@types/sequelize": "^4.28.10",
  "typescript": "~4.1.5" // 可选，ts 语言环境下
}
```

- 添加 npm 命令

```json
"scripts": {
  "start:dev": "tsc && cd dist && cross-env ENV=dev node app.js", // 开发环境启动，环境变量dev
  "start:prod": "tsc && cd dist && cross-env ENV=prod node app.js", // 生产环境启动，环境变量prod
  "test": "cross-env ENV=dev jest", // 运行测试用例
  "test-c": "cross-env ENV=dev jest --coverage" // 运行测试用例（生成覆盖率报告）
}
```

3. 【ts 语言环境】修改 tsconfig.json

```json
"allowJs": true // 允许复制js，不然js源文件不会出现在dist文件夹
```

4. 添加配置文件
   > 文件中的`*`表示环境标识

- db.\*.toml

```toml
[mongo]
database="# 数据库名"
username="# 用户名"
password="# 密码"
host="#服.务.器.IP"
port=27017

[mysql]
database="# 数据库名"
username="# 用户名"
password="# 密码"
host="#服.务.器.IP"
port=3306
```

- models.toml

```toml
version=1 # 模型路由的版本
prefix="# 路由前缀"
type="# 指定的数据源，对应上面db.*.toml方括号中的数据库"
sync=false # 是否在启动时同步，【注意！】设为true会清空数据库
```

- server.\*.toml

```toml
env="# 环境标识，对应配置文件中的*号"
port= # 运行端口
admin="# 管理员，做签发token时会需要"
secret="# 服务秘钥，用于加密"
```

5. 添加到 app.(j|t)s，这是启动文件
   > 这里假设该库作为 submodule 放在 lib 文件夹中，实际使用可根据项目文件具体情况再设置

```javascript
import { genApiRoutes } from "./lib/backend-library/router/index.js";
import { genMdlRoutes } from "./lib/backend-library/models/index.js";

const __dirname = path.resolve(); // ts需添加此行
// 以下两个变量需用到顶级await，具体设置参考google
const router = await genApiRoutes(path.resolve(__dirname, "router"));
const models = (
	await genMdlRoutes(
		path.resolve(__dirname, "models"),
		path.resolve(__dirname, "..", "configs", "db"),
		path.resolve(__dirname, "..", "configs", "models")
	)
).router;
```

6. 【可选】如果要使用 DB 接口，需调用 databases/index 的 getDbByName

```javascript
import path from "path";
import { readConfig } from "../lib/backend-library/utils/index.js";
import { getDbByName } from "../lib/backend-library/databases/index.js";

export const cfgPath = path.resolve("..", "configs");
const mdlCfgPath = path.resolve(cfgPath, "models");
const dbCfgPath = path.resolve(cfgPath, "db");

export function getDatabase() {
	return getDbByName(readConfig(mdlCfgPath).type, dbCfgPath);
}
```

至此，便可开始使用该库。

## 使用方法

### 模型路由

如按以上安装操作，模型文件路径定义在项目目录下的 models 文件夹中。

1. 【如果是自定义模型目录，跳过这步骤】创建 models 文件夹

```
mkdir models && cd models
```

2. 创建模型并配置字段等信息

```javascript
// 创建一个名为user.(j|t)s的文件，以下为内容
import { createHmac } from "crypto";
import { getServerInfo, getDatabase } from "../utils/index.js";

// 此处用到安装步骤中第六步定义的getDatabase方法
const db = await getDatabase();
const svrCfg = getServerInfo();

export default db.defineModel(
	{
		__modelName: "user", // 模型名
		// 以下为字段，可用类型有
		// Id: 项ID类型，可看作rowid
		// String: 字符串
		// Number: 数字
		// Date: 日期
		// Boolean: 布尔
		// Array: 数组
		// Object: 对象
		username: db.PropTypes.String,
		password: db.PropTypes.String,
		phone: db.PropTypes.String,
		avatar: db.PropTypes.String,
	},
	{
		// 可定义中间件，用于介入数据库操作的前、中、后
		middle: {
			create: {
				before(doc: any) {
					// 此处介入数据库create操作之前，对传入的password做不可逆的sha256加密
					if (doc.password.length !== 64) {
						doc.password = createHmac("sha256", svrCfg.secret)
							.update(doc.password)
							.digest("hex");
					}
				},
			},
		},
		// 生成的模型路由，对应增删改查为：POST/DELETE/PUT/GET/ALL
		router: {
			methods: ["POST", "DELETE", "PUT", "GET", "ALL"],
		},
	}
);
```

- 重启项目后便可在终端看到新增模型生成的路由

```
POST    /model-prefix/mdl/v1/user
DELETE  /model-prefix/mdl/v1/user/:id
PUT     /model-prefix/mdl/v1/user/:id
GET     /model-prefix/mdl/v1/user/:id
GET     /model-prefix/mdl/v1/users
```

### 文件路由（koa-router）

如按以上安装操作，文件路径定义在项目目录下的 router 文件夹中。

1. 【如果是自定义模型目录，跳过这步骤】创建 router 文件夹

```
mkdir router && cd router
```

2. 按所需路由创建文件夹及最后的路由文件

```javascript
// router
// |- api-prefix
//    |- api
//       |- v1
//          |- test
//             |- index.(j|t)s
import Router from "koa-router";

const router = new Router();

router.get("/", (ctx) => {
	ctx.body = {
		result: "Hello world",
	};
});

router.get("/:yourName", (ctx) => {
	ctx.body = {
		result: `Hello world ${ctx.request.params.yourName}`,
	};
});

export default router;
```

这样变回生成如下文件路由

```
GET /api-test/api/v1/test
GET /api-test/api/v1/test/:yourName
```
