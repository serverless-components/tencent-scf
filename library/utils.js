const util = require('util')
const fs = require('fs')
const crypto = require('crypto')
const ignore = require('ignore')
const _ = require('lodash')
const Zip = require('./zip')

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
  }
}
