import _ from 'lodash'
import fs from 'fs'
import path from 'path'
import toml from 'toml'
import qiniu from 'qiniu'

// @block{scanPath}:扫描指定目录和子目录
// @type:function
// @includes:lodash
// @includes:fs
// @includes:path
// @params{dirPath}[string]:指定的目录
// @params{options}[object]:扫描方式
//          * *ignores*[```array```]：忽略的目录和文件
//          * *ext*[```string```]：匹配的文件格式
// @return{subPathAry}[array]:扫描出来的文件（带相对路径）
export function scanPath(dirPath, options) {
  // @steps{1}:参数配置，默认扫描方式为空
  if (!options) {
    options = {}
  }
  if (!options.ignores) {
    options.ignores = []
  }
  if (options.ext) {
    if (options.ext[0] !== '.') {
      options.ext = '.' + options.ext
    }
    options.ext = options.ext.toLowerCase()
  }
  if (!options.orgPath) {
    options.orgPath = dirPath
  }
  try {
    fs.accessSync(dirPath)
  } catch (e) {
    return []
  }

  // @steps{2}:扫描当前目录下所有子目录和文件
  let subPathAry = []
  fs.readdirSync(dirPath).map((file) => {
    let absPth = path.join(dirPath, file)
    let relPth = absPth.replace(`${options.orgPath}${path.sep}`, '')
    let pthInfo = path.parse(relPth)
    let fstat = fs.statSync(absPth)
    if (fstat.isDirectory()) {
      // @steps{2_1}:如果是目录，递归调用并把返回值合并进返回值中
      subPathAry = subPathAry.concat(scanPath(absPth, options))
    } else if (fstat.isFile()) {
      // @steps{2_2}:如果是文件，查看是否指定忽略
      let bIgnore = false
      options.ignores.map((ignore) => {
        if (ignore[0] === '*') {
          // @steps{2_2_1}:如果文件名为*，则检查文件后缀
          let ext = ignore.slice(1)
          if (pthInfo.ext === ext) {
            bIgnore = true
          }
        } else {
          // @steps{2_2_2}:如果忽略的是目录，查看相对路径的前ignore\
          //         长度的字符串是否相等
          //         ```
          //         ignore -> node_modules/
          //         relPth -> node_modules/koa/Readme.md
          //         ```
          let pth = relPth
          if (relPth.length > ignore.length) {
            pth = relPth.slice(0, ignore.length)
          }
          // @_steps{2_2_3}:如果忽略的是文件，查看相对路径的后ignore\
          //         长度的字符串是否相等
          //         ```
          //         ignore -> Readme.md
          //         relPth -> node_modules/koa/Readme.md
          //         ```
          // if(pth === ignore) { bIgnore = true }
          // if(relPth.length > ignore.length) {
          //   pth = relPth.slice(-ignore.length)
          // }
          if (pthInfo.base === ignore) {
            bIgnore = true
          }
        }
      })
      // @steps{2_3}:最后把子文件路径塞入返回值中
      !bIgnore && subPathAry.push(relPth)
    }
  })
  return subPathAry
}

export function copyDir(src, dest, options) {
  if (!options) {
    options = {}
  }
  if (!options.ignores) {
    options.ignores = []
  }
  try {
    fs.accessSync(dest)
  } catch (e) {
    fs.mkdirSync(dest, { recursive: true })
  }
  try {
    fs.accessSync(src)
  } catch (e) {
    return false
  }
  // console.log("src:" + src + ", dest:" + dest);
  // 拷贝新的内容进去
  fs.readdirSync(src).forEach(function (item) {
    if (options.ignores.includes(path.join(src, item))) {
      return
    }
    const item_path = path.join(src, item)
    const temp = fs.statSync(item_path)
    if (temp.isFile()) {
      // 是文件
      // console.log("Item Is File:" + item);
      fs.copyFileSync(item_path, path.join(dest, item))
    } else if (temp.isDirectory()) {
      // 是目录
      // console.log("Item Is Directory:" + item);
      copyDir(item_path, path.join(dest, item), options)
    }
  })
}

export function readConfig(cfgFile, withEnv = false) {
  const env = withEnv && process.env.NODE_ENV ? `.${process.env.NODE_ENV}` : ''
  return toml.parse(
    fs.readFileSync(`${cfgFile}${env}.toml`, { encoding: 'utf8' })
  )
}

export function fixStartsWith(text, prefix) {
  return (text.substring(0, prefix.length) !== prefix ? prefix : '') + text
}

export function fixEndsWith(text, suffix) {
  return (
    text +
    (text.substring(text.length - suffix.length) !== suffix ? suffix : '')
  )
}

export function rmvStartsOf(text, prefix) {
  return text.substring(0, prefix.length) === prefix
    ? text.substring(prefix.length)
    : text
}

export function rmvEndsOf(text, suffix) {
  const index = text.lastIndexOf(suffix)
  return index !== -1 ? text.substring(0, index) : text
}

// @block{getErrContent}:从错误对象中获取描述
// @params{err}[object]:错误对象
// @return{ret}[string]:错误描述
export function getErrContent(err) {
  let ret = {}
  if (typeof err === 'string') {
    ret = err
  } else if (err.message && typeof err.message === 'string') {
    ret = err.message
  } else if (err.content && typeof err.content === 'string') {
    ret = err.content
  }
  return ret
}

// prop可用示例
// * prop: 直接访问（为空时则直接返回obj）
// * prop.sub: 访问子字段的字段
// * prop.sub[2]: 访问数组字段指定索引的元素
// * prop.sub[{a:2}]: 访问数组字段指定字段的元素
export function getProp(obj, prop) {
  if (!prop) {
    return obj
  }
  if (prop.indexOf('.') === -1 && prop in obj) {
    prop += '.'
  }
  for (const p of prop.split('.')) {
    if (p === '') {
      continue
    } else if (p.endsWith(']')) {
      if (p.endsWith('}]')) {
        const result = /^(\w+)\[\{(\w+):(\"?\w+\"?)\}\]$/.exec(p)
        if (!result || result.length < 4) {
          throw new Error()
        }
        const sub = result[1]
        const key = result[2]
        const val = result[3]
        obj = obj[sub].find((itm) => itm[key] == val)
      } else {
        const result = /^(\w+)\[(\d+)\]$/.exec(p)
        if (!result || result.length < 3) {
          throw new Error()
        }
        const sub = result[1]
        const idx = parseInt(result[2])
        obj = obj[sub][idx]
      }
    } else {
      obj = obj[p]
    }
  }
  return obj
}

export function setProp(
  obj,
  prop,
  value,
  callback = (base, key, value) => {
    base[key] = value
  }
) {
  if (!prop) {
    return obj
  }
  if (prop.indexOf('.') === -1 && prop in obj) {
    prop = '.' + prop
  }
  const ret = obj
  const props = prop.split('.')
  const lstIdx = props.length - 1
  for (let i = 0; i < props.length; ++i) {
    const p = props[i]
    if (p === '') {
      continue
    } else if (p.endsWith(']')) {
      if (p.endsWith('}]')) {
        const result = /^(\w+)\[\{(\w+):(\"?\w+\"?)\}\]$/.exec(p)
        if (!result || result.length < 4) {
          throw new Error()
        }
        const sub = result[1]
        const key = result[2]
        const val = result[3]
        const idx = obj[sub].findIndex((itm) => itm[key] == val)
        if (idx === -1) {
          throw new Error()
        }
        if (i === lstIdx) {
          callback(obj[sub], idx, value)
        } else {
          obj = obj[sub][idx]
        }
      } else {
        const result = /^(\w+)\[(\d+)\]$/.exec(p)
        if (!result || result.length < 3) {
          throw new Error()
        }
        const sub = result[1]
        const idx = parseInt(result[2])
        if (i === lstIdx) {
          callback(obj[sub], idx, value)
        } else {
          obj = obj[sub][idx]
        }
      }
    } else if (i === lstIdx) {
      callback(obj, p, value)
    } else {
      obj = obj[p]
    }
  }
  return ret
}

export async function uploadToQiniu(qnCfgPath, key, readableStream) {
  const qnCfg = readConfig(qnCfgPath)
  if (!qnCfg.host) {
    qnCfg.host = 'cdn.opteacher.top'
  }
  const mac = new qiniu.auth.digest.Mac(qnCfg.accessKey, qnCfg.secretKey)

  const config = new qiniu.conf.Config({
    zone: qiniu.zone.Zone_z2,
  })

  const url = `http://${qnCfg.host}/${key}`
  let needRefresh = false
  try {
    const resp = await axios.get(new URL(url).href)
    needRefresh = resp.status === 200
  } catch (e) {}

  const putPolicy = new qiniu.rs.PutPolicy({
    scope: `${qnCfg.bucket}:${key}`,
  })
  const uploadToken = putPolicy.uploadToken(mac)

  const formUploader = new qiniu.form_up.FormUploader(config)
  const putExtra = new qiniu.form_up.PutExtra()
  await new Promise((res, rej) => {
    formUploader.putStream(
      uploadToken,
      key,
      readableStream,
      putExtra,
      (respErr, respBody, respInfo) => {
        if (respErr) {
          rej(respErr)
        }
        if (respInfo.statusCode == 200) {
          res(respBody)
        } else {
          console.log(respInfo.statusCode)
          rej(respBody)
        }
      }
    )
  })
  if (needRefresh) {
    // 刷新缓存
    const cdnManager = new qiniu.cdn.CdnManager(mac)
    await new Promise((res, rej) => {
      cdnManager.refreshUrls([url], function (err) {
        err ? rej(err) : res()
      })
    })
  }
  return Promise.resolve(url)
}

export function buildCfgFromPcs(sections, prefix = '') {
  return Object.fromEntries(
    sections
      .map((cfg) =>
        process.env[`${prefix}_${cfg}`]
          ? [cfg, process.env[`${prefix}_${cfg}`]]
          : null
      )
      .filter((cfg) => cfg)
  )
}
