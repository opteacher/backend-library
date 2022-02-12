/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import Path from 'path'
import { fileURLToPath } from 'url'
import { readConfig, scanPath, rmvEndsOf } from '../utils/index.js'

export async function getDbByName(name, cfgPath) {
    const config = readConfig(cfgPath, true)[name]
    const ImplDB = await import (`./${name}.js`)
    return new ImplDB.default(config)
}

export function getAvaDbs () {
    return scanPath(Path.dirname(fileURLToPath(import.meta.url)), { ignores: ['index.js'] })
        .map(dbFile => rmvEndsOf(dbFile, '.js'))
}

export function fmtQuerySQL (sql, query, symbol, options) {
    if (!options) {
      options = {
        addWhere: true,
        tags: []
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
      conds.push(`\`${symbol}\`.\`${key}\` ${valLowCs === 'NULL' ? 'IS' : '='} ${(
        isNaN(parseFloat(value)) &&
        valLowCs !== 'TRUE' &&
        valLowCs !== 'FALSE' &&
        valLowCs !== 'NULL'
      ) ? `'${value}'` : value}`)
    }
    if (conds.length) {
      return sql.trim() + (options.addWhere ? ' WHERE ' : ' AND ') + conds.join(' AND ')
    } else {
      return sql
    }
}
