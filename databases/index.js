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
