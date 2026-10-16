import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCarState, stepCar, formatTime, checkpoints } from '../src/physics.js';

const input = { throttle: 1, steer: 0, boost: false, brake: false };
test('car accelerates forward with a bounded top speed', () => {
  const car = createCarState();
  for (let i = 0; i < 120; i++) stepCar(car, input, 1 / 120);
  assert.ok(car.x > -2.6);
  assert.ok(car.speed > 0 && car.speed <= 5.5);
});
test('brake reduces speed and boost consumes charge', () => {
  const car = createCarState();
  car.speed = 4;
  stepCar(car, { ...input, throttle: 0, brake: true }, .1);
  assert.ok(car.speed < 2);
  stepCar(car, { ...input, boost: true }, .1);
  assert.ok(car.boost < 1);
});
test('collision prevents driving through desktop objects', () => {
  const car = createCarState();
  car.speed = 4;
  const oldX = car.x;
  const result = stepCar(car, input, .05, [{ x: -2.2, z: 4.35, w: .6, d: .6 }]);
  assert.ok(result.collision);
  assert.equal(car.x, oldX);
  assert.ok(car.speed < 0);
});
test('desk boundaries keep car on the table', () => {
  const car = createCarState();
  car.x = 9; car.speed = 5;
  assert.ok(stepCar(car, input, .1).collision);
  assert.ok(car.x <= 9.05);
});
test('ordered checkpoints complete a lap and three laps finish a race', () => {
  const car = createCarState();
  for (let lap = 0; lap < 3; lap++) {
    for (const cp of checkpoints) {
      car.x = cp.x; car.z = cp.z;
      car[cp.axis] -= cp.direction * .05;
      car.angle = cp.axis === 'x' ? cp.direction * Math.PI / 2 : cp.direction === 1 ? 0 : Math.PI;
      car.speed = 2;
      stepCar(car, { ...input, throttle: 0 }, .1);
    }
    assert.equal(car.lap, lap + 1);
  }
  assert.equal(car.finished, true);
  assert.equal(car.lapTimes.length, 3);
});
test('finish line alone does not count a lap', () => {
  const car = createCarState();
  car.x = -.05; car.speed = 2;
  stepCar(car, input, .1);
  assert.equal(car.lap, 0);
});
test('time formatting uses minutes, seconds and centiseconds', () => {
  assert.equal(formatTime(65.129), '01:05.12');
  assert.equal(formatTime(0), '00:00.00');
});
