const playwright = require("playwright");
const async = require('async');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const request = require('request');
const applogger = require('./applogger');
const config = require('./config');

var dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/;

module.exports = async function getData(listaAgencias) {
    
    return new Promise(async function (resolve, reject) {

        let fechaHoy = moment().format('YYYY-MM-DD');
        let browserType = 'firefox';
        // Randomly select a browser
        // You can also specify a single browser that you prefer

            applogger(browserType); // To know the chosen one

            try {

                const browser = await playwright[browserType].launch();
                const context = await browser.newContext();
                const page = await context.newPage();
                await page.goto("https://www.instagram.com/accounts/login/");

                await page.waitForSelector("text=Accept All", { state: 'visible' });
                await page.click("text=Accept All");

                await page.waitForSelector('[type=submit]', {
                    state: 'visible'
                });

                await page.waitForSelector("text=Accept All", { state:'detached' });

                // You can also take screenshots of pages
                // await page.screenshot({
                //   path: `ig-sign-in.png`,
                // });

                await page.click("[name=username]");

                await page.waitForSelector('[type=submit]', {
                    state: 'visible'
                });
                
                // You can also take screenshots of pages
                // await page.screenshot({
                //   path: `ig-sign-in.png`,
                // });

                await page.type("[name=username]", config.get('IG_USUARIO'));
                await page.type('[type="password"]', config.get('IG_CLAVE'));
                await page.click("[type=submit]");
                await page.waitForSelector('[placeholder=Search]', { state: 'visible' });

                
                for (let n=0;n<listaAgencias.length;n++) {

                    applogger(`inicio procesando agencia: ${listaAgencias[n].usuario}`);
        
                    setTimeout(async function poblarPublicaciones() {
                        
                        await page.goto(`https://www.instagram.com/${listaAgencias[n].usuario}`);
                        await page.waitForSelector("img", {
                            state: 'visible',
                        });
                        
                        // await page.screenshot({ path: `profile.png` });
                        // Execute code in the DOM
                        const html = await page.content();
                        //console.log(data);
                        /*
                        const data = await page.evaluate(() => {
                            const images = document.querySelectorAll("img");
                            const urls = Array.from(images).map((v) => v.src);
                            return urls;
                        });
                        */   
                        
                        var result = await parsearDatosHtml(html);
                        
                        applogger(`datos de usuario: ${listaAgencias[n].usuario} obtenidos, empieza proceso ...`);
                        
                        for (let i=0;i<result.medias.length;i++) {
                            
                            // si es_video no procesamos
                            if (result.medias[i].is_video) {
                                continue;
                            }
                            
                            var fechaUnixPublicacion = moment.unix(result.medias[i].date);
                    
                            if (fechaHoy != fechaUnixPublicacion.format('YYYY-MM-DD')) {
                                applogger('se omite por fecha de publicacion fechaHoy:' + fechaHoy + ' fechaPublicacion:' + fechaUnixPublicacion.format('YYYY-MM-DD'));

                                // si es la ultima agencia y su ultima publicacion
                                // cerramos y invocamos resolve
                                // console.log(`${listaAgencias.length} ${n+1} # ${result.medias.length} ${i+1}`);
                                if (listaAgencias.length == (n+1) && result.medias.length == (i+1)) {
                                    applogger(`ingresa a cerrar instancia del navegador y ejecutar resolve`);
                                    await browser.close();
                                    resolve('procesado');
                                } else {
                                    continue;
                                }

                            }
                            
                            try {
                                var body = {
                                    "id": uuidv4(),
                                    "fechaPublicacion": fechaUnixPublicacion.format('YYYY-MM-DD'),
                                    "horaPublicacion": fechaUnixPublicacion.format('HH:mm:ss'),
                                    "media_id": result.medias[i].media_id,
                                    "owner_id": result.medias[i].owner_id,
                                    "shortcode": result.medias[i].shortcode,
                                    "is_video": result.medias[i].is_video,
                                    "like_count": result.medias[i].like_count,
                                    "miniatura": result.medias[i].thumbnail,
                                    "imagenPublicacion": result.medias[i].display_url,
                                    
                                    "descripcion": quitarAcentos(result.medias[i].text.toLowerCase()),
                                    
                                    "fechaAlta": fechaHoy,
                                    "horaALta": moment().format('HH:mm:ss'),
                                    "usuarioInstagram": listaAgencias[n].usuario,
                                    "pais": "paraguay"
                                }
                            } catch (error) {
                                applogger('se omite ' + i + ' de ' + listaAgencias[n].usuario);
                                continue;
                            }

                            request.post({
                                method: 'POST',
                                uri: config.get('PUBLICACION_AGREGAR_URL'),
                                headers: {'content-type': 'application/json'},
                                json: JSON.stringify(body)  
                            }, async function (error, res, _body) {
                                
                                if (error) {
                                    console.error(error);
                                    return;
                                }

                                applogger(`${listaAgencias[n].usuario} ${i} guardar aws statusCode: ${res.statusCode}`);

                                if (res.statusCode == 200) {

                                    let bodyIMG = {
                                        url: result.medias[i].thumbnail,
                                        nombreImagen: result.medias[i].owner_id+'_'+result.medias[i].shortcode + '_' + result.medias[i].media_id,
                                        usuario: listaAgencias[n].usuario
                                    }

                                    request.post({
                                        method: 'POST',
                                        uri: config.get('PUBLICACION_BAJAR_IMAGEN'),
                                        headers: {'content-type': 'application/json'},
                                        json: JSON.stringify(bodyIMG)  
                                    }, async function (errorImg, resImg, bodyImg) {
                                        
                                        if (errorImg) {
                                            console.error(errorImg);
                                            return;
                                        }
    
                                        applogger(`${listaAgencias[n].usuario} ${i} guardar imagen statusCode: ${resImg.statusCode}`);
        
                                    });
                                }
                                
                                // si es la ultima agencia y su ultima publicacion
                                // cerramos y invocamos resolve
                                // console.log(`${listaAgencias.length} ${n+1} # ${result.medias.length} ${i+1}`);
                                if (listaAgencias.length == (n+1) && result.medias.length == (i+1)) {
                                    applogger(`ingresa a cerrar instancia del navegador y ejecutar resolve`);
                                    await browser.close();
                                    resolve('procesado');
                                }

                            });
                            
                        }
        
                        applogger(`fin procesando agencia: ${listaAgencias[n].usuario}`);
        
                    }, n * 15000);
                    
                    //break;
                    
                }
            } catch (error) {
                applogger('errgral ' + error);
                reject('no_procesado');
            }
        
    });
}


var parsearDatosHtml = async function (html) {
    
    return new Promise(async function(resolve, reject) {

        var data = scrape(html);

        if (data && data.entry_data &&
            data.entry_data.ProfilePage &&
            data.entry_data.ProfilePage[0] &&
            data.entry_data.ProfilePage[0].graphql &&
            data.entry_data.ProfilePage[0].graphql.user &&
            data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media &&
            data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.count > 0 && data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges) {
            
            var edges = data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges;
            
            async.waterfall([
                (callback) => {
                    var medias = [];
                    edges.forEach((post) => {
                        if (post.node.__typename === 'GraphImage'||post.node.__typename === 'GraphSidecar' || post.node.__typename === 'GraphVideo') {
                            medias.push(exports.scrapePostData(post))
                        }
                    });
                    callback(null, medias);
                }
            ], (err, results) => {
    
                if (err) {
                    reject(err);
                }
    
                resultado = {
                    total: results.length,
                    medias: results,
                    user: data.entry_data.ProfilePage[0].graphql.user
                }
    
                resolve(resultado);
            })
        }

    });  

}

exports.scrapePostData = function (post) {
  var scrapedData = {
      media_id: post.node.id,
      shortcode: post.node.shortcode,
      text: post.node.edge_media_to_caption.edges[0] && post.node.edge_media_to_caption.edges[0].node.text,
      comment_count: post.node.edge_media_to_comment.count,
      like_count: post.node.edge_liked_by.count,
      display_url: post.node.display_url,
      owner_id: post.node.owner.id,
      date: post.node.taken_at_timestamp,
      thumbnail: post.node.thumbnail_src,
      thumbnail_resource: post.node.thumbnail_resources,
      is_video: post.node.is_video
  }

  if (post.node.is_video) {
      scrapedData.video_view_count = post.node.video_view_count;
  }

  return scrapedData;
}

var scrape = function (html) {
  try {
      var dataString = html.match(dataExp)[1];
      var json = JSON.parse(dataString);
  }
  catch (e) {
      if (process.env.NODE_ENV != 'production') {
          console.error('The HTML returned from instagram was not suitable for scraping');
      }
      return null
  }

  return json;
}

function quitarAcentos(texto) {
    return texto.replace('á', 'a').replace('é','e').replace('í','i').replace('ó','o').replace('ú','u');
}