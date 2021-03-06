let map;
const geoFirestore = new GeoFirestore(firestore);
const geoCollectionRef = geoFirestore.collection('viewers');
let subscription;
const markers = {};
const radius = 1500;

// Query viewers' locations from Firestore
function queryFirestore(location) {
  if (subscription) {
    console.log('Old query subscription cancelled');
    subscription();
    subscription = false;
  }

  const query = geoCollectionRef.near({
    center: new firebase.firestore.GeoPoint(location.lat, location.lng),
    radius
  });

  console.log('New query subscription created');
  subscription = query.onSnapshot((snapshot) => {
    console.log(snapshot.docChanges())
    snapshot.docChanges().forEach((change) => {
      switch (change.type) {
        case 'added':
          console.log('Snapshot detected added marker');
          return addMarker(change.doc.id, change.doc.data());
        case 'modified':
          console.log('Snapshot detected modified marker');
          return updateMarker(change.doc.id, change.doc.data());
        case 'removed':
          console.log('Snapshot detected removed marker');
          return removeMarker(change.doc.id, change.doc.data());
        default:
          break;
      }
    });
  });
}

// First find if viewer's location is in Firestore
function getInFirestore(location) {
  location.lat = Number(location.lat.toFixed(1));
  location.lng = Number(location.lng.toFixed(1));
  const hash = geokit.Geokit.hash(location);

  geoCollectionRef.doc(hash).get().then((snapshot) => {
    let document = snapshot.data();
    if (!document) {
      document = {
        count: 1,
        coordinates: new firebase.firestore.GeoPoint(location.lat, location.lng)
      };
      console.log('Provided key is not in Firestore, adding document: ', JSON.stringify(document));
      setInFirestore(hash, document);
    } else {
      document.count++;
      console.log('Provided key is in Firestore, updating document: ', JSON.stringify(document));
      setInFirestore(hash, document);
    }
  }, (error) => {
    console.log('Error: ' + error);
  });
}

// Set viewer's location in Firestore
function setInFirestore(key, document) {
  geoCollectionRef.doc(key).set(document).then(() => {
    console.log('Provided document has been set in Firestore');
  }, (error) => {
    console.log('Error: ' + error);
  });
}


// Initialize Map
function initMap() {
  var userLocation;
  var mapCenter;

  map = new google.maps.Map(document.getElementById('map'), {
    center: {
      lat: 41.3083,
      lng: -72.9279
    },
    zoom: 8
  });


  // Get users location
  navigator.geolocation.getCurrentPosition((success) => {
    userLocation = {
      lat: success.coords.latitude,
      lng: success.coords.longitude
    };
    map.setCenter(userLocation);
    new google.maps.Marker({
      position: userLocation,
      map: map,
      icon: './assets/bluedot.png'
    });

    // Add viewer's location to Firestore
    getInFirestore(userLocation);
  }, console.log);


  map.addListener('idle', function () {
    var getCenter = map.getCenter()
    var center = {
      lat: getCenter.lat(),
      lng: getCenter.lng()
    };

    if (!mapCenter || geokit.Geokit.distance(mapCenter, center) > (radius * 0.7)) {
      mapCenter = center;
      queryFirestore(center);
    }
  });
}

// Add Marker to Google Maps
function addMarker(key, document) {
  if (!markers[key]) {
    var infowindow = new google.maps.InfoWindow({
      content: document.count + ' people from this area have viewed this page'
    });

    markers[key] = new google.maps.Marker({
      position: {
        lat: document.coordinates.latitude,
        lng: document.coordinates.longitude
      },
      map: map
    });

    markers[key].addListener('click', function () {
      infowindow.open(map, markers[key]);
    });
  }
}

// Remove Marker to Google Maps
function removeMarker(key) {
  if (markers[key]) {
    google.maps.event.clearListeners(markers[key], 'click');
    markers[key].setMap(null);
    markers[key] = null;
  }
}

// Update Marker on Google Maps
function updateMarker(key, document) {
  if (markers[key]) {
    var infowindow = new google.maps.InfoWindow({
      content: document.count + ' people from this area have viewed this page'
    });

    markers[key].setPosition({
      lat: document.coordinates.latitude,
      lng: document.coordinates.longitude
    });

    google.maps.event.clearListeners(markers[key], 'click');

    markers[key].addListener('click', function () {
      infowindow.open(map, markers[key]);
    });
  } else {
    addMarker(key, document);
  }
}