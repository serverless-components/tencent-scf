const fs = require('fs')
const archiver = require('archiver')

class Zip {
  constructor(outName) {
    this.outName = outName
    this.outFileStream = fs.createWriteStream(this.outName)
    const _this = this

    this.archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    })

    this.archive.on('warning', function(err) {
      _this.clean()
      throw err
    })

    // good practice to catch this error explicitly
    this.archive.on('error', function(err) {
      _this.clean()
      throw err
    })

    this.archive.pipe(this.outFileStream)
  }

  addFile(path, alias) {
    const body = fs.createReadStream(path)
    this.archive.append(body, { name: alias, stats: fs.statSync(path) })
  }

  addBuff(buff, alias) {
    this.archive.append(buff, { name: alias })
  }

  addDir(dir, alias) {
    if (alias) {
      this.archive.directory(dir, { name: alias })
    } else {
      this.archive.directory(dir)
    }
  }

  finalize() {
    const _this = this
    return new Promise(async (res) => {
      this.archive.finalize()
      this.outFileStream.on('close', function() {
        res(_this.archive.pointer())
      })
    })
  }

  clean() {
    this.outFileStream.close()
    fs.unlinkSync(this.outName)
  }
}

module.exports = Zip
