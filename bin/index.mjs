#!/usr/bin/env node

import yargs from 'yargs'
import { join, extname, basename, dirname } from 'path'
import { promises } from 'fs'

const options = yargs
    .usage("Usage: -e <excludePaths>")
    .option("e", { alias: "excludePaths", describe: "Exclude css paths in json format", type: "string", demandOption: false })
    .argv;

const getTerminator = (string) => {
    return `.${string.split('.').slice(1).join('.')}`
}

const getBasename = (fileWithPath) => {
    return basename(fileWithPath, extname(fileWithPath))
}

const getAllFiles = async (dirPath, extensions, { excludePaths = ['node_modules'], excludeExtensions = [] }) => {

    const files = await promises.readdir(dirPath)

    let res = await Promise.all(files.map(async (file) => {
        const fileWithPath = join(dirPath, "/", file)
        if (excludePaths.includes(fileWithPath)) return []
        const fileStat = await promises.stat(fileWithPath)
        if (fileStat.isDirectory()) {
            return await getAllFiles(fileWithPath, extensions, { excludePaths, excludeExtensions })
        } else {
            return [{ dirPath, file, fileWithPath, basename: getBasename(fileWithPath) }]
        }
    }))

    return res.flat().filter(el => extensions.includes(extname(el.file)) && !excludeExtensions.includes(getTerminator(el.file)))
}

const getAllNonModuleCssFiles = async (excludePaths) => {
    return await getAllFiles('.', [".css"], { excludePaths: ['node_modules'].concat(excludePaths), excludeExtensions: [".module.css"] })
}

const run = (str, regex) => [...str.matchAll(regex)]

(async () => {
    // Get list of non module css files.
    let excludePaths
    if (options.excludePaths === undefined)
        excludePaths = []
    else
        excludePaths = JSON.parse(options.excludePaths)
    const res = await getAllNonModuleCssFiles(excludePaths)

    // Replace imports with modular nextjs pattern
    await Promise.all(res.map(async cssFile => {
        const readCss = await promises.readFile(cssFile.fileWithPath, 'utf8')

        const readClassnames = run(readCss, /([\.#][_A-Za-z0-9\-]+)(?=[^}]+{)/gm)
        const uniqueClassnames = [...new Set(readClassnames.map(m => m[1].slice(1)))]

        let sourceFiles = await getAllFiles('.', [".js", ".jsx", ".ts", ".tsx"], {})
        // sourceFiles = sourceFiles.filter(sourceFile => sourceFile.file === "TeamChannelHeader.js")
        await Promise.all(sourceFiles.map(async sourceFile => {
            const read = await promises.readFile(sourceFile.fileWithPath, 'utf8')

            let reaplacementsToDo = []
            const imports = run(read, new RegExp(`^import (".*${cssFile.basename}.css")|('.*${cssFile.basename}.css')`, "gm"))
            imports.forEach(imp => {
                const split = imp[0].split('.')
                split.splice(split.length - 1, 0, "module")
                const joined = split.join(".")
                // draft = draft.replace(imp[0], "styles from " + joined)
                reaplacementsToDo.push({data: imp[0], toReplace: "styles from " + joined})
            })
            if (imports.length) {
                const classnamesInSource = run(read, /(?<=className=)('.*?'|".*?")|{\S*[ ]*\?[ ]*('.*?'|".*?")[ ]*:[ ]*('.*?'|".*?")[ ]*}(?=.*>)/gm)
                classnamesInSource.map(classnameInSource => {
                    let data
                    let group
                    if (classnameInSource[1] !== undefined) {
                        group = 1
                        data = classnameInSource[1]
                    }
                    if (classnameInSource[2] !== undefined) {
                        group = 2
                        data = classnameInSource[2]
                    }
                    if (classnameInSource[3] !== undefined) {
                        group = 3
                        data = classnameInSource[3]
                    }

                    const withinQuotes = data.slice(1, data.length - 1)
                    const usedClassnames = withinQuotes.split(" ")
                    let toReplace = usedClassnames.map(usedClassname => uniqueClassnames.includes(usedClassname) ? `styles["${usedClassname}"]`: usedClassname)
                    if (toReplace.length >= 2){
                        toReplace = `[${toReplace.join(", ")}].join(" ")`
                    }
                    if (group === 1) {
                        toReplace = `{${toReplace}}`
                    }
                    reaplacementsToDo.push({data, toReplace})
                })
            }

            let draft = read
            reaplacementsToDo.forEach(replacement => {
                console.log(replacement)
                draft = draft.replace(replacement.data, replacement.toReplace)
            })
            if (draft !== read) {
                await promises.writeFile(sourceFile.fileWithPath, draft)
            }
        }))

    }))

    // Rename css files to have .module.css extension.
    await Promise.all(res.map(cssFile => {
        const extension = ".css"
        const theBasename = basename(cssFile.fileWithPath, extension)
        const theDirname = dirname(cssFile.fileWithPath)
        promises.rename(join(theDirname, basename(cssFile.fileWithPath)), join(theDirname, `${theBasename}.module${extension}`))
    }))
})()
