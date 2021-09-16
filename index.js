"use strict";

/**
 * @inheritDoc http://phantomjs.org/api/webpage/handler/on-url-changed.html
 */

const phantom = require('phantom');
const Promise = require('bluebird');
const config = require("config");
const url = require('url');
const _ = require('lodash');

// pages on hold
let pending = [];
let active = [];
let visited = [];
let defaultHost = "";

const listFormat = [
  {
    width: 1280,
    heigth: 800,
  },
  {
    width: 1440,
    heigth: 900,
  },
  {
    width: 1680,
    heigth: 1050,
  },
  {
    width: 1920,
    heigth: 1200,
  },
  {
    width: 2560,
    heigth: 1140,
  },
  {
    width: 768,
    heigth: 1024,
  },
  {
    width: 320,
    heigth: 480,
  },
];

let opts =  {
    delay: 25000,
    concurrent: 20,
};

let resources = [];

let referers = [
  'http://www.recette.fr',
  'http://www.google.fr'
];

let limitedHost = [];

let userAgents = [
  'Mozilla/5.0 (Windows NT 6.3; WOW64; rv:47.0) Gecko/20100101 Firefox/47.0',
  'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; ASU2JS; rv:11.0) like Gecko',
  'Opera/9.80 (J2ME/MIDP; Opera Mini/6.5.26955/27.1407; U; en) Presto/2.8.119 Version/11.10',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.62 Safari/537.36',
  'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko',
  'Qwantify/1.0',
  'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.102 Safari/537.36 Vivaldi/1.93.955.38',
];

/**
 * Test if is on admit site
 * @param urlSending
 * @return {boolean}
 */
const isOnAdmitSite = urlSending => {
    const currentURL = url.parse(urlSending);
    if (currentURL.hostname && ~limitedHost.indexOf(currentURL.hostname)) {
        return true;
    }
    // console.log("Host is not valid ", currentURL.hostname, " for ", urlSending);
    return false;
};

/**
 * Get current page host
 * @param urlSending
 * @return {*}
 */
const getCurrentHost = urlSending => {
  const currentURL = url.parse(urlSending);
  if (currentURL.host) {
    return currentURL.protocol + '//' + currentURL.host;
  }
  return defaultHost;
};

/**
 * Add host
 */
const addHost = (urlSending, defaultHost) => {
  const currentURL = url.parse(urlSending);
  if (currentURL.host) {
    return urlSending;
  }
  return defaultHost + currentURL.path;
};

/**
 * Change internal page.
 */
const changeInternalPage = (page, pagesLoaded) => {
  console.log("List of page Loaded", pagesLoaded);
  let currentPage = '';
  return page.evaluate(function () {
    return window.location.pathname;
  })
  .then(t => {
    currentPage = t;
    console.log('****************************************** step 1 :: ', t);
    return new Promise(resolve => {
      setTimeout(function () {
        resolve();
      }, (opts.delay + Math.floor((Math.random() * 10) + 1)));
    });
  })
  .then(() => page.evaluate(function () {
    if (window.jQuery) {
      return true;
    }
    return false;
  }))
  .then(isJquery => {
    if (!isJquery) {
      return page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js');
    }
  })
  .then(() => page.evaluate(function() {
    if (window.jQuery) {
      $("html, body").animate({scrollTop: Math.floor((Math.random() * $(document).height()) + 1)}, "slow");
    }
  }))
  .then(() => {
    // 1 chance sur 4 de renseigner l'un des formulaires
   /* if ( Math.floor((Math.random() * 4)) === 1 ) {
      return;
    }*/
    return page.evaluate(function () {
      /**
       * generate a random string with letter
       * @param data
       */
      function randomString() {
        return Math.random().toString(36).substring(2, 15);
      }
  
      /**
       * Signed with random string with letter
       * @param data
       */
      function signedNameField(data) {
        switch($(data).attr('name')) {
          case 'pseudo':
          case 'prenom':
          case 'name':
          case 'lastname':
          case 'firstname':
          case 'nom':
          case 'ville':
            $(data).val( randomString())
            break;
        }
      }
  
      /**
       * If there is no forms
       */
      if (!$('form:visible').length) {
        return false;
      }
      var randomForm = $('form:visible').get(Math.floor((Math.random() * $('form').length)));
        $(randomForm).find('input').each(function(){
          switch($(this).attr('type')) {
            /*
            case 'select':
              $(this).
              break;
            case 'checkbox':
              $(this).
              break;
            case 'date':
              $(this).val(new Date());
              break;
            case 'radio':
              break;
            **/
            case 'email':
              $(this).val('aparrochia+99@gmail.com');
              break;
            case 'text':
              $(this).val(signedNameField($(this)));
              break;
            case 'search':
              $(this).val(signedNameField($(this)));
              break;
            case 'tel':
              $(this).val('0606060606');
              break;
            case 'password':
              $(this).val('password75!');
              break;
            /**
            case 'hidden':
              break;
            case 'image':
              break;
             **/
            default:
              break;
          }
        });
        var formAction = $(randomForm).attr('action') || $(randomForm).attr('name') || $(randomForm).html();
        randomForm.submit();
        return formAction;
    });
  })
  /**
   * Test if a new page was calling, if not, continue
   */
  .then(t => {
    console.log('/********************************************* formAction', t);
    if (!t) {
      return false;
    }
    return new Promise(resolve => {
      var maxtimeOutMillis = 10000,
        start = new Date().getTime(),
        condition = false;
    
      var interval = setInterval(function() {
        if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
          // Definit la condition a true pour pas lancer le test plusieurs fois d'affilés
          condition = true;
          /**
           * Test currentURL
           */
          page.evaluate(function() {
            return window.location.pathname;
          })
          .then(pageFound => {
            condition = false;
            // if page changed, pass to next step
            if (pageFound !== currentPage) {
              clearInterval(interval);
              resolve({
                href: pageFound,
                formulaire: t,
              });
            }
          })
          // if fail, stop all
          .catch(err => {
            condition = false;
            console.warn(err);
            clearInterval(interval);
            resolve(false);
          });
        
          // if timeout, began with a new page
        } else if (!condition) {
          console.warn('Timeout for form has expired');
          clearInterval(interval);
          resolve(false);
        }
      }, 250);
    })
  })
  .then(t => {
    /**
     * If page change, reload jquery
     */
    if (t && t.href && t.href !== currentPage) {
      currentPage = t.href;
      console.log("****************************************** page reload");
      pushNewPage(pagesLoaded, currentPage, t);
    }
  })
  .then(() => page.evaluate(function () {
    if (window.jQuery) {
      return true;
    }
    return false;
  }))
  .then(isJquery => {
    if (!isJquery) {
      return page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js');
    }
  })
  /**
   * Scroll on page
   */
  .then(() => page.evaluate(function () {
    $("html, body").animate({scrollTop: Math.floor((Math.random() * $(document).height()) + 1)}, "slow");
  }))
  .then(() => {
    return page.evaluate(function () {
      try {
        var listValidLink = [];
        $("a:visible").each(function(){
          var href = $(this).attr('href');
          if (href && (href.indexOf('/') === 0 || href.indexOf('/') === "#")) {
            listValidLink.push($(this));
          }
        });
        if (!listValidLink.length) {
          return false;
        }
        var num = Math.floor((Math.random() * listValidLink.length));
        var BTN = $(listValidLink[num]).get(0);
        var event = document.createEvent('MouseEvent');
        event.initEvent('click', true, true);
        BTN.dispatchEvent(event);
        return {
          title: $(BTN).attr('title') || $(BTN).find('p').text(),
          href: $(BTN).attr('href'),
        };
      } catch(err) {
        return false;
      }
    })
  })
  .then(t => {
    if (!t) {
      endPage(pagesLoaded, currentPage);
      throw new Error('Nothing to follow, continue');
    }
    pushNewPage(pagesLoaded, currentPage, t);
    return new Promise((resolve, reject) => {
      var maxtimeOutMillis = 10000,
        start = new Date().getTime(),
        condition = false;
      
      var interval = setInterval(function() {
        if ( (new Date().getTime() - start < maxtimeOutMillis) && !condition ) {
          // Definit la condition a true pour pas lancer le test plusieurs fois d'affilés
          condition = true;
          /**
           * Test currentURL
           */
          page.evaluate(function() {
            return window.location.pathname;
          })
          .then(pageFound => {
            condition = false;
            // if page changed, pass to next step
            if (pageFound !== currentPage) {
              clearInterval(interval);
              resolve(pageFound);
            }
          })
          // if fail, stop all
          .catch(err => {
            condition = false;
            console.warn(err);
            clearInterval(interval);
            reject(currentPage);
          });
          
        // if timeout, began with a new page
        } else if (!condition) {
          console.warn('Timeout expired');
          clearInterval(interval);
          reject(currentPage);
        }
      }, 250);
    });
  })
  .then(() => changeInternalPage(page, pagesLoaded))
  .catch(err => endPage(pagesLoaded, currentPage, err));
};

/**
 * Push new page in history.
 * @param pagesLoaded
 * @param pageLink
 * @param link
 */
const pushNewPage = (pagesLoaded, pageLink, data) => {
  if (!pagesLoaded[pageLink]) {
    pagesLoaded[pageLink] = [];
  }
  pagesLoaded[pageLink].push(data);
};

/**
 * Update a page in history.
 * @param pagesLoaded
 * @param pageLink
 * @param link
 */
const endPage = (pagesLoaded, pageLink, err) => {
  console.warn('******************************* navigation kill', err);
  if (pagesLoaded[pageLink]) {
    pagesLoaded[pageLink][(pagesLoaded[pageLink].length - 1)].end = true;
  }
};

/**
 * Call a new page
 * @param pageLink
 */
function newPage(pageLink) {
  let sitepage = null;
  let phInstance = null;
  active.push(pageLink);
  let currentHost = "";
  let pagesLoaded = {};

  phantom.create([], {
    logLevel: 'info',
  })
  .then(instance => {
      phInstance = instance;
      return instance.createPage(['--ignore-ssl-errors=yes', '--load-images=no', '--webdriver-loglevel=WARN', '--logLevel=WARN']);
  })
  .then(page => {
    sitepage = page;
    // select on format of current page
    const testFormat = listFormat[Math.floor((Math.random() * listFormat.length))];
    console.log('/********************** test page :: ', pageLink , " with format ", testFormat);
    
		page.property('onUrlChanged', function(targetUrl) {
      console.log('****************************************** onUrlChanged ', targetUrl);
		});

    page.property('onError', function(msg, trace) {
        console.log('******************** on error ', msg);
        if (trace) {
            trace.forEach(function (t) {
                console.log(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
            });
        }
    });
  
    /*page.property('onResourceReceived', function(response) {
      console.log('////////////// onResourceReceived', response);
      if (response.stage !== "end") {
        return;
      }
      if (response.headers.filter(function(header) {
          if (header.name == 'Content-Type' && header.value.indexOf('text/html') == 0) {
            return true;s
          }
          return false;
        }).length > 0) {
        console.log('******************************************** onResourceReceived', response);
      }
    });
    page.property('onLoadStarted', function () {
     console.warn('onLoadStarted');
   });
    page.property('onNavigationRequested', function(url) {
      console.log('******************** onNavigationRequested ', url);
    });
    // http://www.mathieurobin.com/2013/04/phantomjs-chargez-et-jouez-avec-vos-sites-en-js-sans-quitter-la-console/
    page.property('onResourceReceived', function(resource) {
     console.log('**************************** onResourceReceived');
     console.log('onResourceReceived ', resource.url, ' call on ', pageLink , ' respond status code ', resource.status, ' ressource type ', response.contentType);
   
     if (resource.status >= 400) {
     console.warn('Ressource ', resource.url, ' call on ', pageLink , ' respond status code ', resource.status);
     }
     });
   page.property('onResourceError', function(res) {
       console.log('onResourceError v0.0', res.status, ' on ', res.url);
       console.log('pagesLoaded v0');
   
       if (res.status >= 400 && pagesLoaded[res.url]) {
       pagesLoaded[res.url].error = res.status;
       console.log('Fail to load page', res.url, " with statusCode ", res.status);
       }
     });
    */
    
    page.property('pageCreated', function(url) {
      console.log('******************** pageCreated ', url);
    });
    
    page.property('urls', function(url) {
      console.log('******************** url ', url);
    });
  
  
    page.property('tabCreated', function(url) {
      console.log('******************** tabCreated ', url);
    });
  
    page.property('tabClosed', function(url) {
      console.log('******************** tabClosed ', url);
    });
    
    
		page.property('onResourceTimeout', function(request) {
			console.log('onResourceTimeout Response (#' + request.id + '): ' + JSON.stringify(request));
		});
		
		page.setting('javascriptEnabled').then(function(value){
			if (value != true) {
				console.log('javascriptEnabled', value);
				phInstance.exit();
			}
		});
 
		return page.property('viewportSize', {
			width: testFormat.width,
			height: testFormat.heigth,
		})
		.then(function() {
      //console.log('/********************** 1');
      const numRef = Math.floor((Math.random() * referers.length));
      currentHost = getCurrentHost(pageLink);
      pushNewPage(pagesLoaded, pageLink, {
        origin: referers[numRef],
        dimensions: testFormat,
      });
      return page.open(pageLink, {
        method: 'get',
        headers: {
          'user-agent': userAgents[Math.floor((Math.random() * userAgents.length))],
          referer: referers[numRef],
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'fr,fr-FR;q=0.8,de-DE;q=0.6,en-US;q=0.4,en;q=0.2',
          'cache-control': 'max-age=0',
          'connection': 'keep-alive',
          'Upgrade-Insecure-Requests': 1,
        }
      })
		})
		.then(function(status) {
			if (status !== 'success') {
				throw new Error('fail to success');
				return null;
			}
			return page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js')
		})
    .then(() => page.evaluate(function() {
      if (window.jQuery) {
        $("html, body").animate({scrollTop: Math.floor((Math.random() * $(document).height()) + 1)}, "slow");
      }
    }))
		.then(function() {
      //console.log('/********************** 3');
		    return page.evaluate(function() {
		      var listHref = [];
          $( "a:visible" ).each(function() {
            var href = $( this ).attr('href');
            if (href.length > 2 && href.indexOf("#") !== 0) {
              listHref.push(href)
            }
          });
				  return listHref;
		   });
		})
		.then(function(links) {
      //console.log('/********************** 4');
      if (!links || !links.length) {
        return;
      }
      links.forEach(function (element) {
        const currentURL = addHost(element, currentHost);
        if (isOnAdmitSite(currentURL) && !~visited.indexOf(currentURL)) {
         // console.log("Push new URL: " + currentURL);
          visited.push(currentURL);
          pending.push(currentURL);
          // queue();
        }
      });
    })
    .then(function() {
      //console.log('/********************** 5');
      return new Promise(resolve => {
        changeInternalPage(page, pagesLoaded)
        .then(() => {
          resolve();
        })
        .catch(err => {
          console.warn("*********************************** changing page fail", err);
          resolve();
        });
      });
    })
    .then(() => {
      console.log('/********************** 8');
      deleteFromActive(pageLink);
      return sitepage.close();
    })
    .then(() => phInstance.exit());
  })
  .then(() => queue())
  .catch(error => {
    console.log("List of page Loaded", pagesLoaded);
    deleteFromActive(pageLink);
    console.log('/********************** page exit :: ' + error);
    console.log(error);
    phInstance.exit();
  });
}

/**
 * Delete current page from actives pages
 * @param pageLink
 */
const deleteFromActive = pageLink => {
  var i = active.indexOf(pageLink);
  if (i !== -1) {
    active.splice(i, 1);
  }
};
/**
 * Is waiting queue in waiting mode.
 * @return {boolean}
 */
function full() {
  return active.length >= opts.concurrent;
}

/**
 * Detect if we start a new spider.
 */
function queue() {
  if (full()) {
  } else if (!pending.length) {
  } else {
    /**
     * Récupère le premier lien en attente.
     */
    var url = pending[0];
    pending.splice(0, 1);
    newPage(url);
  }
}

function init() {
  opts = config.get('opts'),
  // console.log('********************************* concurrent :: ', opts.concurrent);
  defaultHost = config.get('defaultHost', "https://www.babies-pets.com"),
  limitedHost = config.get('limitedHost', []);
  newPage(config.get('startURL', "https://www.babies-pets.com"));
}

init();



