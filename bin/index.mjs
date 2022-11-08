#!/usr/bin/env node

// console.log( "Hello!" );

import { join, extname } from 'path'
import { statSync, promises } from 'fs'

const getAllFiles = async (dirPath, extensions, excludePaths) => {

    const files = await promises.readdir(dirPath)

    let res = await Promise.all(files.map(async (file) => {
        const fileWithPath = join(dirPath, "/", file)
        if (excludePaths.includes(fileWithPath)) return []
        if (statSync(fileWithPath).isDirectory()) {
            return await getAllFiles(fileWithPath, extensions, excludePaths)
        } else {
            return [fileWithPath]
        }
    }))

    return res.flat().filter(el => extensions.includes(extname(el)))
}

// (async () => {
//     const files = await getAllFiles('.', [".mjs", ".json"])
//     console.log(files)
// })()

const getAllCssFiles = async () => {
    return await getAllFiles('.', [".css"], ['node_modules'])
}

(async () => {
    const files = await getAllCssFiles()
    console.log(files)
})()
