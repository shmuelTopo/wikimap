/*globals google*/

(async function () {
  "use strict";
  let pcsLocation = { lat: 40.108847085561855, lng: -74.21764970472604 };
  const map = new google.maps.Map($("#map")[0], {
    center: location,
    zoom: 14,
  });

  function initializeMap(location) {
    map.panTo(location);
  }

  function executeAfterDelay(callback, delay) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(callback());
        } catch (e) {
          reject(e);
        }
      }, delay);
    });
  }

  async function searchPlaces(searchTerm) {
    try {
      let response = await fetch(
        `http://api.geonames.org/wikipediaSearch?q=${searchTerm}&maxRows=${$(
          "#numResults"
        ).val()}&username=shmueltopo&type=json`
      );
      const locations = await response.json();

      return locations.geonames.map((e) => {
        return {
          location: { lat: e.lat, lng: e.lng },
          title: e.title,
          summary: e.summary,
          url: e.wikipediaUrl,
          img: e.thumbnailImg,
        };
      });
    } catch (e) {
      console.error(e);
    }
  }

  //Set Position to current location, if user refuses set location to default

  navigator.geolocation.getCurrentPosition(
    (pos) =>
      initializeMap({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => initializeMap(pcsLocation) // error function if user refuses
  );

  // Add event to display search range
  $("#numResults").on("input chagne", () => {
    $("#rangeDiv span").text($("#numResults").val());
  });

  const markers = [];
  let selectedPlace;
  $("form").submit(async (e) => {
    e.preventDefault();
    const places = await searchPlaces($("#search-container input").val(), 10);
    const bounds = new google.maps.LatLngBounds();

    // clean the previous results
    $("#places").empty();
    markers.forEach((marker) => {
      marker.setMap(null);
    });
    markers.length = 0;

    places.forEach((place) => {
      bounds.extend(place.location);
      const markerContent = `
                <h3>${place.title}</h3>
                <p>${place.summary}</p>
                <a target=”_blank” href="https://${place.url}">wikipedia</a>
            `;
      const infowindow = new google.maps.InfoWindow({
        content: markerContent,
      });

      const marker = new google.maps.Marker({
        position: place.location,
        map: map,
        title: place.title,
      });

      marker.addListener("click", () => {
        infowindow.open({
          anchor: marker,
          map,
          shouldFocus: false,
        });
      });

      markers.push(marker);

      const imgUrl = place.img ? place.img : "./images/image-placeholder.png";
      const li = $(`
                <div class="place-card">
                    <h3>${place.title}</h3>
                    <img src="${imgUrl}" alt="${
        place.img ? "image of" : "no image found for"
      } ${place.title}">
                    <p class="summary">${place.summary}</p>
                </div>
            `)
        .appendTo($("#places"))
        .click(async function () {
          //if the current place is selected, user wants to close the info on the place
          if (selectedPlace === place) {
            $(".summary").slideUp("slow");
            selectedPlace = null;
            return;
          }

          //if new place is being selected
          selectedPlace = place;
          $(".summary").slideUp("slow");
          li.find(".summary").slideDown("slow");

          const boundsToGoTo = map.getBounds();
          boundsToGoTo.extend(marker.getPosition());
          map.fitBounds(boundsToGoTo);
          await executeAfterDelay(() => map.panTo(marker.getPosition()), 1000);
          await executeAfterDelay(() => map.setZoom(18), 1000);
          


        });
    });

    map.fitBounds(bounds);

    // adust the zoom level, if the map is zoomed in too much
    const zoomLevel = map.getZoom();
    if(zoomLevel > 18) map.setZoom(18)
    
  });

  const drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.MARKER,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.MARKER,
        google.maps.drawing.OverlayType.CIRCLE,
        google.maps.drawing.OverlayType.POLYGON,
        google.maps.drawing.OverlayType.POLYLINE,
        google.maps.drawing.OverlayType.RECTANGLE,
      ],
    },
    markerOptions: {
      icon: "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
    },
    circleOptions: {
      fillColor: "#ffff00",
      fillOpacity: 0.3,
      strokeWeight: 2,
      clickable: true,
      editable: true,
      zIndex: 1,
    },
  });

  drawingManager.setMap(map);

  let shapesData;
  let shapesDataJSON = localStorage.getItem("shapesMemory");

  if (shapesDataJSON) {
    shapesData = JSON.parse(shapesDataJSON);

    shapesData.markers.forEach((m) => {
      new google.maps.Marker({
        position: m.position,
        map: map,
        animation: google.maps.Animation.DROP,
        title: "Your marker",
        icon: {
          url: m.icon,
          scaledSize: new google.maps.Size(20, 32),
        },
      });
    });

    shapesData.circles.forEach((c) => {
      new google.maps.Circle({
        fillColor: "#ffff00",
        fillOpacity: 0.3,
        strokeWeight: 2,
        map: map,
        center: c.center,
        radius: c.radius,
      });
    });

    shapesData.polygons.forEach((p) => {
      new google.maps.Polygon({
        paths: p.path,
        map: map,
      });
    });

    shapesData.polylines.forEach((p) => {
      new google.maps.Polyline({
        path: p.path,
        map: map,
      });
    });

    shapesData.rectangles.forEach((r) => {
      new google.maps.Rectangle({
        bounds: r.bounts,
        map: map,
      });
    });
  } else {
    shapesData = {
      markers: [],
      circles: [],
      polygons: [],
      polylines: [],
      rectangles: [],
    };
  }

  google.maps.event.addListener(
    drawingManager,
    "markercomplete",
    function (marker) {
      shapesData.markers.push({
        position: { lat: marker.position.lat(), lng: marker.position.lng() },
        icon: marker.icon,
      });
      localStorage.setItem("shapesMemory", JSON.stringify(shapesData));
    }
  );

  google.maps.event.addListener(
    drawingManager,
    "circlecomplete",
    function (circle) {
      shapesData.circles.push({
        center: circle.getCenter(),
        radius: circle.getRadius(),
      });
      localStorage.setItem("shapesMemory", JSON.stringify(shapesData));
    }
  );

  google.maps.event.addListener(
    drawingManager,
    "polygoncomplete",
    function (polygon) {
      const vertices = polygon.getPath();
      const polygonPath = [];
      for (let i = 0; i < vertices.getLength(); i++) {
        const xy = vertices.getAt(i);
        polygonPath.push({ lat: xy.lat(), lng: xy.lng() });
      }
      shapesData.polygons.push({
        path: polygonPath,
      });
      localStorage.setItem("shapesMemory", JSON.stringify(shapesData));
    }
  );

  google.maps.event.addListener(
    drawingManager,
    "polylinecomplete",
    function (polyline) {
      const pathArray = polyline.getPath().getArray();
      const polylinePath = [];
      pathArray.forEach((xy) => {
        polylinePath.push({ lat: xy.lat(), lng: xy.lng() });
      });

      shapesData.polylines.push({
        path: polylinePath,
      });

      localStorage.setItem("shapesMemory", JSON.stringify(shapesData));
    }
  );

  google.maps.event.addListener(
    drawingManager,
    "rectanglecomplete",
    function (rectangle) {
      const bounds = rectangle.getBounds();
      shapesData.rectangles.push({
        bounts: {
          north: bounds.Ab.h,
          south: bounds.Ab.g,
          east: bounds.Ra.h,
          west: bounds.Ra.g,
        },
      });
      localStorage.setItem("shapesMemory", JSON.stringify(shapesData));
    }
  );
})();
