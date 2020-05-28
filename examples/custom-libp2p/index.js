'use strict'

const PeerInfo = require('peer-info');
const Libp2p = require('libp2p')
const IPFS = require('ipfs')
const TCP = require('libp2p-tcp')
const MulticastDNS = require('libp2p-mdns')
const Bootstrap = require('libp2p-bootstrap')
const SPDY = require('libp2p-spdy')
const KadDHT = require('libp2p-kad-dht')
const MPLEX = require('libp2p-mplex')
const SECIO = require('libp2p-secio')

const Websockets = require('libp2p-websockets')
const WebrtcStar = require('libp2p-webrtc-star')
const wrtc = require('wrtc')

const Upgrader = require('./node_modules/libp2p/src/upgrader')

const signalServerIP = () => {
  return '127.0.0.1' // (I am running an instance of libp2p-webrtc-star/src/sig-server on a droplet)
}

const signalServerCID = () => {
  return 'QmXEWB3eEUZygXPbxhs4XuyJvffJUXSVe8PmdNrN123456'
}


/**
 * Options for the libp2p bundle
 * @typedef {Object} libp2pBundle~options
 * @property {PeerInfo} peerInfo - The PeerInfo of the IPFS node
 * @property {PeerBook} peerBook - The PeerBook of the IPFS node
 * @property {Object} config - The config of the IPFS node
 * @property {Object} options - The options given to the IPFS node
 */

/**
 * This is the bundle we will use to create our fully customized libp2p bundle.
 *
 * @param {libp2pBundle~options} opts The options to use when generating the libp2p node
 * @returns {Libp2p} Our new libp2p node
 */
const libp2pBundle = () => {
  // Set convenience variables to clearly showcase some of the useful things that are available
  PeerInfo.create().then((pi) => {
    const peerInfo = pi
    // const peerBook = null // opts.peerBook
    const bootstrapList = [`/ip4/${signalServerIP()}/tcp/63785/ipfs/${signalServerCID()}`]

    const upgrader = new Upgrader({ localPeer: peerInfo })
    const wrtcStar = new WebrtcStar({ wrtc, upgrader })
    // Build and return our libp2p node
    // n.b. for full configuration options, see https://github.com/libp2p/js-libp2p/blob/master/doc/CONFIGURATION.md
    const p2p = new Libp2p({
      peerInfo,
      // Lets limit the connection managers peers and have it check peer health less frequently
      connectionManager: {
        minPeers: 25,
        maxPeers: 100,
        pollInterval: 5000
      },
      modules: {
        transport: [
          TCP,
          Websockets,
          wrtcStar
        ],
        streamMuxer: [
          MPLEX,
          SPDY
        ],
        connEncryption: [
          SECIO
        ],
        peerDiscovery: [
          MulticastDNS,
          Bootstrap,
          wrtcStar.discovery
        ],
        dht: KadDHT
      },
      config: {
        EXPERIMENTAL: {
          pubsub: true
        },
        peerDiscovery: {
          autoDial: true, // auto dial to peers we find when we have less peers than `connectionManager.minPeers`
          mdns: {
            interval: 10000,
            enabled: true
          },
          bootstrap: {
            interval: 30e3,
            enabled: true,
            list: bootstrapList
          }
        },
        // Turn on relay with hop active so we can connect to more peers
        relay: {
          enabled: true,
          hop: {
            enabled: true,
            active: true
          }
        },
        dht: {
          enabled: true,
          kBucketSize: 20,
          randomWalk: {
            enabled: true,
            interval: 10e3, // This is set low intentionally, so more peers are discovered quickly. Higher intervals are recommended
            timeout: 2e3 // End the query quickly since we're running so frequently
          }
        },
        pubsub: {
          enabled: true
        }
      },
      metrics: {
        enabled: true,
        computeThrottleMaxQueueSize: 1000,  // How many messages a stat will queue before processing
        computeThrottleTimeout: 2000,       // Time in milliseconds a stat will wait, after the last item was added, before processing
        movingAverageIntervals: [           // The moving averages that will be computed
          60 * 1000, // 1 minute
          5 * 60 * 1000, // 5 minutes
          15 * 60 * 1000 // 15 minutes
        ],
        maxOldPeersRetention: 50            // How many disconnected peers we will retain stats for
      }
    })

    p2p.start().then(() => {
      console.log('p2p started...');
      p2p.on('peer:connect', (peerInfo) => {
        console.info(`Connected to ${peerInfo.id.toB58String()}!`)
      })
    }).catch((ex) => {
      console.error(ex);
      console.error(ex.stack);
    })

  }).catch((ex) => {
    console.error(ex);
  });

}

libp2pBundle()
