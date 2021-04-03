const getData = require('./getData');
const applogger = require('./applogger');
const config = require('./config');
const request = require('request');
const cron = require('node-cron');


cron.schedule('0 14 * * *', () => {
	ejecutar();
    var data = 'agendado para ejecucion';
    applogger(data);
});


var ejecutar = async function() {

	request.get({
		method: 'GET',
		uri: config.get('AGENCIAS_LISTA_URL'),
		headers: {'content-type': 'application/json'}
	}, async function (error, res, listaAgencias) {
		
		if (error) {
			console.error(error);
			applogger(`hubo un error al invocar lista agencias: ${error}`);
			return;
		}
	
		applogger(`lista agencias statusCode: ${res.statusCode}`);
	
		listaAgencias = JSON.parse(listaAgencias);
	
		if (res.statusCode == 200) {

			try {
				await getData(listaAgencias);

				var data = 'proceso finalizado';
				applogger(data);

			} catch (error) {

				var data = 'completado con error \n';
				data += 'error: ' + error;
				applogger(data);

			}
			
		} else {
			var data = 'no se pudo procesar';
			applogger(data);
		}
	
	});

}
