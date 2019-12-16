const util = require('util')
const fs = require('fs')
const ignore = require('ignore')
const _ = require('lodash')
const Zip = require('./zip')
const path = require('path')
const archiver = require('archiver')
const globby = require('globby')
const { contains, isNil, last, split } = require('ramda')
const { createReadStream, createWriteStream } = require('fs-extra')

const VALID_FORMATS = ['zip', 'tar']
const isValidFormat = (format) => contains(format, VALID_FORMATS)

module.exports = {
  zipArchiveDirs(zipObject, dirPath, alias, packagePath, ig) {
    const dirs = fs.readdirSync(dirPath)
    if (!dirs) {
      throw new Error('cannot read function file. ' + dirPath)
    }

    for (let i = 0; i < dirs.length; i++) {
      const filePath = util.format('%s/%s', dirPath, dirs[i])
      const fullAlias = util.format('%s/%s', alias, dirs[i])
      const fstat = fs.statSync(filePath)
      if (fstat.isDirectory()) {
        this.zipArchiveDirs(zipObject, filePath, fullAlias, packagePath, ig)
      } else {
        if (_.isEmpty(ig)) {
          zipObject.addFile(filePath, fullAlias)
          continue
        }

        if (!ig.ignores(fullAlias)) {
          zipObject.addFile(filePath, fullAlias)
          continue
        }
      }
    }
    return true
  },

  async zipArchive(packagePath, outZipFile, ignoreFile) {
    const dirs = fs.readdirSync(packagePath)
    if (!dirs) {
      throw new Error('cannot read function file. ' + packagePath)
    }

    let ig
    if (ignoreFile && !_.isEmpty(ignoreFile)) {
      ig = ignore().add(ignoreFile)
    } else {
      ig = null
    }

    const zip = new Zip(outZipFile)
    for (let i = 0; i < dirs.length; i++) {
      // if (dirs[i] == Constants.ScfZipTmpDir) continue; // skip
      const filePath = util.format('%s/%s', packagePath, dirs[i])

      const fstat = fs.statSync(filePath)
      if (fstat.isFile()) {
        if (_.isEmpty(ig)) {
          zip.addFile(filePath, dirs[i])
          continue
        }

        if (!ig.ignores(dirs[i])) {
          zip.addFile(filePath, dirs[i])
          continue
        }
      }

      if (fstat.isDirectory()) {
        this.zipArchiveDirs(zip, filePath, dirs[i], packagePath, ig)
      }
    }
    const size = await zip.finalize()
    return size
  },
  sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  },

  async packDir(inputDirPath, outputFilePath, include = [], exclude = [], prefix) {
    const format = last(split('.', outputFilePath))

    if (!isValidFormat(format)) {
      throw new Error('Please provide a valid format. Either a "zip" or a "tar"')
    }

    const patterns = ['**']

    if (!isNil(exclude)) {
      exclude.forEach((excludedItem) => patterns.push(`!${excludedItem}`))
    }

    const files = (await globby(patterns, { cwd: inputDirPath, dot: true }))
      .sort() // we must sort to ensure correct hash
      .map((file) => ({
        input: path.join(inputDirPath, file),
        output: prefix ? path.join(prefix, file) : file
      }))

    return new Promise((resolve, reject) => {
      const output = createWriteStream(outputFilePath)
      const archive = archiver(format, {
        zlib: { level: 9 }
      })

      output.on('open', async () => {
        archive.pipe(output)

        // we must set the date to ensure correct hash
        files.forEach((file) =>
          archive.append(createReadStream(file.input), { name: file.output, date: new Date(0) })
        )

        if (!isNil(include)) {
          for (let i = 0, len = include.length; i < len; i++) {
            const curInclude = include[i]
            if (fs.statSync(curInclude).isDirectory()) {
              // if is relative directory, we should join with process.cwd
              const curPath = path.isAbsolute(curInclude)
                ? curInclude
                : path.join(process.cwd(), curInclude)
              const includeFiles = await globby(patterns, { cwd: curPath, dot: true })
              includeFiles
                .sort()
                .map((file) => ({
                  input: path.join(curPath, file),
                  output: prefix ? path.join(prefix, file) : file
                }))
                .forEach((file) =>
                  archive.append(createReadStream(file.input), {
                    name: file.output,
                    date: new Date(0)
                  })
                )
            } else {
              const stream = createReadStream(curInclude)
              archive.append(stream, { name: path.basename(curInclude), date: new Date(0) })
            }
          }
        }

        archive.finalize()
      })

      archive.on('error', (err) => reject(err))
      output.on('close', () => resolve(outputFilePath))
    })
  }
}
