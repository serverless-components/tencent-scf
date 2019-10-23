'use strict';

const util = require('util');
const fs = require('fs');
const crypto = require('crypto');
const ignore = require('ignore');
const _ = require('lodash');
const Zip = require('./zip');

module.exports = {
	zipArchiveDirs(zipObject, dirPath, alias, packagePath, ig) {
		const dirs = fs.readdirSync(dirPath);
		if (!dirs)
			throw new Error('cannot read function file. ' + dirPath);

		for (let i = 0; i < dirs.length; i++) {
			const filePath = util.format('%s/%s', dirPath, dirs[i]);
			const fullAlias = util.format('%s/%s', alias, dirs[i]);
			const fstat = fs.statSync(filePath);
			if (fstat.isDirectory())
				zipArchiveDirs(zipObject, filePath, fullAlias, packagePath, ig);
			else {
				if (_.isEmpty(ig)) {
					zipObject.addFile(filePath, fullAlias);
					continue;
				}

				if (!ig.ignores(fullAlias)) {
					zipObject.addFile(filePath, fullAlias);
					continue;
				}
			}
		}
		return true;
	},
	async zipArchive(packagePath, outZipFile, ignoreFile) {
		const dirs = fs.readdirSync(packagePath);
		if (!dirs)
			throw new Error('cannot read function file. ' + packagePath);

		let ig;
		if (ignoreFile && !_.isEmpty(ignoreFile))
			ig = ignore().add(ignoreFile);
		else
			ig = null;

		const zip = new Zip(outZipFile);
		for (let i = 0; i < dirs.length; i++) {
			// if (dirs[i] == Constants.ScfZipTmpDir) continue; // skip
			const filePath = util.format('%s/%s', packagePath, dirs[i]);

			const fstat = fs.statSync(filePath);
			if (fstat.isFile()) {
				if (_.isEmpty(ig)) {
					zip.addFile(filePath, dirs[i]);
					continue;
				}

				if (!ig.ignores(dirs[i])) {
					zip.addFile(filePath, dirs[i]);
					continue;
				}
			}

			if (fstat.isDirectory())
				this.zipArchiveDirs(zip, filePath, dirs[i], packagePath, ig);
		}
		const size = await zip.finalize();
		return size;
	},
	isPathExists(path) {
		try {
			fs.accessSync(path);
		} catch (err) {
			return false;
		}
		return true;
	},
	sleep(ms) {
		return new Promise(resolve => {
			setTimeout(resolve, ms)
		})
	},
	TC3HMACSHA256(service, req, secretId, secretKey) {

		const ApiVersion = '2018-04-16';
		const ApiTc3Request = 'tc3_request';
		const ApiSignedHeaders = "content-type;host";

		const hosts = {
			'scf': 'scf.tencentcloudapi.com'
		}

		const PrefixInteger = function (num, length) {
			return (Array(length).join('0') + num).slice(-length);
		}

		const sign = function (key, msg, hex) {
			if (hex)
				return crypto.createHmac('sha256', key)
					.update(msg, 'utf8')
					.digest('hex');
			else
				return crypto.createHmac('sha256', key)
					.update(msg, 'utf8');
		}

		const newDate = new Date();
		const timestamp = Math.ceil(newDate.getTime() / 1000);
		const ctype = "application/json";
		const algorithm = "TC3-HMAC-SHA256"
		const payload = JSON.stringify(req);
		const canonical_headers = util.format("content-type:%s\nhost:%s\n", ctype, hosts[service]);
		const http_request_method = "POST";
		const canonical_uri = '/';
		const canonical_querystring = '';
		const date = util.format('%s-%s-%s', newDate.getFullYear(),
			PrefixInteger(newDate.getMonth() + 1, 2),
			PrefixInteger(newDate.getUTCDate(), 2));

		const hashed_request_payload = crypto.createHash('sha256').update(payload, 'utf8').digest();
		const canonical_request = (http_request_method + "\n" +
			canonical_uri + "\n" +
			canonical_querystring + "\n" +
			canonical_headers + "\n" +
			ApiSignedHeaders + "\n" +
			hashed_request_payload.toString('hex'));

		const credential_scope = date + "/" + service + "/" + ApiTc3Request;
		const hashed_canonical_request = crypto.createHash('sha256').update(canonical_request, 'utf8').digest();
		const string_to_sign = (algorithm + "\n" +
			timestamp + "\n" +
			credential_scope + "\n" +
			hashed_canonical_request.toString('hex'));

		const secret_date = sign("TC3" + secretKey, date, false);
		const secret_service = sign(Buffer.from(secret_date.digest('hex'), 'hex'), service, false);
		const secret_signing = sign(Buffer.from(secret_service.digest('hex'), 'hex'), ApiTc3Request, false);
		const signature = sign(Buffer.from(secret_signing.digest('hex'), 'hex'), string_to_sign, true);

		return {
			host: hosts[service],
			version: ApiVersion,
			timestamp: timestamp,
			sign: util.format('%s Credential=%s/%s, SignedHeaders=%s, Signature=%s',
				algorithm, secretId, credential_scope, ApiSignedHeaders, signature)
		}
	}
};
