import { readConfig } from '../utils/index.js'

export async function getDbByName(name, cfgPath) {
    const config = readConfig(cfgPath, true)[name]
    const ImplDB = await import (`./${name}.js`)
    return new ImplDB.default(config)
}
