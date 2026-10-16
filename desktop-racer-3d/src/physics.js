export const checkpoints = [
  { x: 7.6, z: 0, axis: 'z', direction: -1 },
  { x: 0, z: -4.35, axis: 'x', direction: -1 },
  { x: -7.6, z: 0, axis: 'z', direction: 1 },
  { x: 0, z: 4.35, axis: 'x', direction: 1 },
];

export function createCarState() {
  return { x: -2.6, z: 4.35, angle: Math.PI / 2, speed: 0, boost: 1, nextCheckpoint: 0, lap: 0, time: 0, lapTimes: [], lapStart: 0, finished: false };
}

export function stepCar(car, input, dt, obstacles = []) {
  if (car.finished) return { collision: false, lap: false };
  const oldX = car.x, oldZ = car.z;
  car.time += dt;
  const boosting = input.boost && input.throttle > 0 && car.boost > .02;
  car.boost = Math.max(0, Math.min(1, car.boost + (boosting ? -.28 : .105) * dt));
  car.speed += (input.throttle * (boosting ? 13 : 8) - car.speed * 1.45) * dt;
  if (input.brake) car.speed *= Math.exp(-8 * dt);
  car.speed = Math.max(-2.6, Math.min(boosting ? 8.8 : 5.5, car.speed));
  car.angle += input.steer * Math.min(Math.abs(car.speed) * .65, 2.65) * Math.sign(car.speed) * dt;
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  let collision = false;
  if (Math.abs(car.x) > 9.05 || Math.abs(car.z) > 5.04) {
    car.x = Math.max(-9.05, Math.min(9.05, car.x));
    car.z = Math.max(-5.04, Math.min(5.04, car.z));
    car.speed *= -.35;
    collision = true;
  }
  for (const o of obstacles) {
    if (Math.abs(car.x - o.x) < o.w / 2 + .27 && Math.abs(car.z - o.z) < o.d / 2 + .27) {
      car.x = oldX; car.z = oldZ;
      car.speed *= -.4;
      collision = true;
      break;
    }
  }
  const checkpoint = checkpoints[car.nextCheckpoint];
  const oldAxis = checkpoint.axis === 'x' ? oldX : oldZ;
  const newAxis = car[checkpoint.axis];
  const line = checkpoint[checkpoint.axis];
  const crossed = checkpoint.direction === 1 ? oldAxis < line && newAxis >= line : oldAxis > line && newAxis <= line;
  const otherAxis = checkpoint.axis === 'x' ? 'z' : 'x';
  let lap = false;
  if (crossed && Math.abs(car[otherAxis] - checkpoint[otherAxis]) < 1.25) {
    car.nextCheckpoint = (car.nextCheckpoint + 1) % 4;
    if (car.nextCheckpoint === 0) {
      car.lap++;
      car.lapTimes.push(car.time - car.lapStart);
      car.lapStart = car.time;
      car.finished = car.lap >= 3;
      lap = true;
    }
  }
  return { collision, lap };
}

export function formatTime(seconds) {
  const centiseconds = Math.floor(seconds * 100);
  return `${String(Math.floor(centiseconds / 6000)).padStart(2, '0')}:${String(Math.floor(centiseconds / 100) % 60).padStart(2, '0')}.${String(centiseconds % 100).padStart(2, '0')}`;
}
