/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
// import Path from "path";
// import { fileURLToPath } from "url";
import { readConfig, buildCfgFromPcs } from '../utils/index.js'

export async function getDbByName(name, config) {
  return new (await import(`./${name}.js`)).default(
    Object.assign(
      typeof config === 'string' ? readConfig(config, true)[name] : config,
      buildCfgFromPcs(
        ['database', 'username', 'password', 'host', 'port'],
        'db'
      )
    )
  )
}

export function getAvaDbs() {
  // return scanPath(Path.dirname(fileURLToPath(import.meta.url)), {
  // 	ignores: ["index.js"],
  // }).map((dbFile) => rmvEndsOf(dbFile, ".js"));
  return []
}

export function fmtQuerySQL(sql, query, symbol, options) {
  if (!options) {
    options = {
      addWhere: true,
      tags: [],
    }
  }
  if (typeof options.addWhere === 'undefined') {
    options.addWhere = true
  }
  if (!options.tags) {
    options.tags = []
  }
  const conds = []
  switch (query.scope) {
    case 'week':
      conds.push(`DATEDIFF(CURDATE(), \`${symbol}\`.\`createdAt\`) < 7`)
      break
    case 'month':
      conds.push(`DATEDIFF(CURDATE(), \`${symbol}\`.\`createdAt\`) < 30`)
      break
    case 'year':
      conds.push(`DATEDIFF(CURDATE(), \`${symbol}\`.\`createdAt\`) < 365`)
      break
  }
  delete query.scope
  for (const tag of options.tags) {
    if (!query[tag]) {
      continue
    }
    const tagsSet = typeof query[tag] === 'string' ? [query[tag]] : query[tag]
    for (const tagVal of tagsSet) {
      conds.push(`\`${symbol}\`.\`${tag}\` LIKE '%${tagVal}%'`)
    }
    delete query[tag]
  }
  for (const [key, value] of Object.entries(query)) {
    const valLowCs = value.toUpperCase()
    conds.push(
      `\`${symbol}\`.\`${key}\` ${valLowCs === 'NULL' ? 'IS' : '='} ${
        isNaN(parseFloat(value)) &&
        valLowCs !== 'TRUE' &&
        valLowCs !== 'FALSE' &&
        valLowCs !== 'NULL'
          ? `'${value}'`
          : value
      }`
    )
  }
  if (conds.length) {
    return (
      sql.trim() +
      (options.addWhere ? ' WHERE ' : ' AND ') +
      conds.join(' AND ')
    )
  } else {
    return sql
  }
}

export function getPropType(struct, prop) {
  if (!prop) {
    return struct
  }
  if (prop.indexOf('.') === -1 && prop in struct) {
    prop += '.'
  }
  const props = prop.split('.')
  for (let i = 0; i < props.length; ++i) {
    const p = props[i]
    if (p === '') {
      continue
    } else if (p.endsWith(']')) {
      const endIdx = p.indexOf('[')
      if (endIdx === -1) {
        throw new Error()
      }
      const sub = p.substring(0, endIdx)
      struct = struct[sub]
      // 如果检索的是数组元素，则直接返回数组类型
      if (struct.length && i !== props.length - 1) {
        struct = struct[0]
      }
    } else {
      struct = struct[p]
    }
  }
  if (!struct) {
    return
  }
  return struct.type || struct
}
