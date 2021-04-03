const fs = require('fs');

module.exports =  function applogger(logData) {
	fs.appendFile('app.log', (new Date() + ' ' + logData + '\n'), function (err) {
		if (err) throw err;
	});
}