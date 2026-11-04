import test from "node:test";
import assert from "node:assert/strict";
import { isDistanceClaim } from "../distanceClaims";

/* The project page shows distances only in its computed Distances strip. Feed
   amenities and extra facts restating them are hidden; real values from the
   DB on 2026-10-31. */

test("distance claims in every wording the feeds use", () => {
  for (const s of [
    "300 meters from Finikoudes Beach & Promenade", "Only 1500 metres from the sea", "100 meters from Mackenzie Beach",
    "5 min to A6 Highway", "3 mins from Ermou Street", "2 Minutes from Lefkara Square", "5-min walk from city facilities",
    "Best schools 10 min", "Sea: 1 min", "Airport: 28 min",
    "Distance to beach: approx. 500 m", "Distance to highway: less than 1 km", "Distance to Limassol city centre: 20-minute drive",
    "Walking Distance to Restaurants & Cafes", "Walking Disatnce to Restaurants & Cafes", "Few Meters from the New Marina & Port",
    "Close to Restaurants, Cafés & Daily Amenities", "Proximity to the City Center", "Nearby Local Amenities", "Easy Access to the Beach",
  ]) assert.ok(isDistanceClaim(s), s);
});

test("sizes, pools, heights, deadlines and views are not distances", () => {
  for (const s of [
    "40m Riverlike pool", "25m Common Pool", "Swimming pool 32 x 10 m", "Pool: 8 × 3.5 m", "3 meter ceiling height",
    "Plot area: 1,748 m²", "Unit size: 42- 102 m²", "Delivery: 24 months from the planning permit", "Delivery: 30 months from signing",
    "10.1 kW photovoltaic system with solar panels", "Sea views", "Beachfront, direct access to the beach", "Walking paths and communal green spaces",
    "Walk-in wardrobe", "24/7 security", "Total units: 16", "",
  ]) assert.ok(!isDistanceClaim(s), s);
  assert.equal(isDistanceClaim(null), false);
});
