/*

  SPH Fluid Simulation - Core Library

  Source repository:
  https://github.com/tommccracken/sph-fluid-simulation


  Copyright 2020 Thomas O. McCracken

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.

*/

// Useful constants

const PI = Math.PI;

// Useful functions

function deg2rad(deg) {
  return deg * PI / 180;
}

function rad2deg(rad) {
  return rad * 180 / PI;
}

function get_time() {
  return Date.now();
}

function time_since(time) {
  return (get_time() - time);
}

// Vector (2D) math class

class Vector2 {

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  magnitude_squared() {
    return this.x * this.x + this.y * this.y;
  }

  magnitude() {
    return Math.sqrt(this.magnitude_squared());
  }

  unit_vector() {
    return new Vector2(this.x / this.magnitude(), this.y / this.magnitude());
  }

  add(v) {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  add_to_this(v) {
    this.x = this.x + v.x;
    this.y = this.y + v.y;
  }

  subtract(v) {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  subtract_from_this(v) {
    this.x = this.x - v.x;
    this.y = this.y - v.y;
  }

  scale(scalar) {
    return new Vector2(scalar * this.x, scalar * this.y);
  }

  scale_this(scalar) {
    this.x = scalar * this.x;
    this.y = scalar * this.y;
  }

  set_to(v) {
    this.x = v.x;
    this.y = v.y;
  }

  set_to_zero() {
    this.x = 0;
    this.y = 0;
  }

  rotate_about(v, angle) {
    let x,
      y;
    x = v.x + (this.x - v.x) * Math.cos(angle) - (this.y - v.y) * Math.sin(angle);
    y = v.y + (this.x - v.x) * Math.sin(angle) + (this.y - v.y) * Math.cos(angle);
    return new Vector2(x, y);
  }

  distance_from_squared(v) {
    return (v.x - this.x) * (v.x - this.x) + (v.y - this.y) * (v.y - this.y);
  }

  distance_from(v) {
    return Math.sqrt(this.distance_from_squared(v));
  }

}

// Abstract world element class
class AbstractWorldElement {

  constructor() {
    // The length of time that the world element has been in existence (number of simulation steps)
    this.age = 0;
    // The age at which the world element will be deleted, null if infinite life
    this.lifetime = null;
  }

  // Check to see whether the age of a world element has reached its life
  has_life_expired() {
    if ((this.lifetime !== null) && (this.age >= this.lifetime)) {
      return true;
    } else {
      return false;
    }
  }

}

// Particle class
class Particle extends AbstractWorldElement {

  constructor(px, py, vx, vy, ax, ay, fx, fy, mass, radius, fixed) {
    super();
    // The mass of the particle
    this.mass = mass;
    this.inv_mass = 1 / mass;
    // The radius of the particle
    this.radius = radius;
    // This property defines whether the particle is allowed to move
    this.fixed = fixed;
    // A vector representing the current position of the particle
    this.pos = new Vector2(px, py);
    // A vector representing the previous position of the particle (necessary for Verlet integration)
    this.pos_previous = new Vector2(px, py);
    // A vector representing the current velocity of the particle (can also be determined implicitly from pos and prev_pos)
    this.vel = new Vector2(vx, vy);
    // A vector representing the current acceleration of the particle (necessary for Verlet integration)
    this.acc = new Vector2(ax, ay);
    // A vector representing the net force acting on the particle
    this.force = new Vector2(fx, fy); // Note: this is actually not being used at this time
    // Temporary integration variable (slight optimisation)
    this.temp_pos = new Vector2(px, py);
    // Represents whether a particle is permitted to collide with anything
    this.collides = true;
    // The lifetime of the particle
    this.lifetime = null;
    // Co-efficient of restitution (particle-boundary)
    this.coefficient_of_restitution = 0.3;
    // Indicates whether the particle is a SPH fluid particle
    this.SPH_particle = false;
    // List of SPH fluid neighbours
    this.SPH_neighbours = [];
    // Interpolated density at SPH fluid particle
    this.SPH_density = 0;
  }

  integrate(time_step) {
    if (!this.fixed) {
      // Verlet integration based on mutable vector operations
      this.force.scale_this(this.inv_mass);
      this.acc.add_to_this(this.force);
      this.temp_pos.x = this.pos.x;
      this.temp_pos.y = this.pos.y;
      this.acc.scale_this(time_step * time_step);
      this.acc.subtract_from_this(this.pos_previous);
      this.acc.add_to_this(this.pos);
      this.acc.add_to_this(this.pos);
      this.pos.set_to(this.acc);
      this.pos_previous.set_to(this.temp_pos);
    }
  }

  calculate_velocity(time_step) {
    this.vel = (this.pos.subtract(this.pos_previous)).scale(1 / time_step);
  }

}

class AbstractConstraint extends AbstractWorldElement {

  constructor() {
    super();
    // Defines whether the constraint can be broken
    this.breakable = false;
    // The maximum allowable breaking strain of the constraint
    this.breaking_strain = 2.0;
  }

  has_broken() {
    return false;
  }

}

class DistanceConstraint extends AbstractConstraint {

  constructor(p1, p2, distance, stiffness) {
    super();
    this.p1 = p1;
    this.p2 = p2;
    this.distance = distance;
    this.stiffness = stiffness;
    this.current_distance = this.p2.pos.distance_from(this.p1.pos);
  }

  enforce(constraint_solver_iterations) {
    let adjusted_stiffness,
      delta,
      deltad,
      deltad1,
      deltad2,
      direction_unit_vector;
    this.current_distance = this.p2.pos.distance_from(this.p1.pos);
    if (this.current_distance !== this.distance) {
      delta = this.current_distance - this.distance;
      adjusted_stiffness = 1 - Math.pow(1 - this.stiffness, 1 / constraint_solver_iterations);
      deltad = (this.current_distance - this.distance) * adjusted_stiffness;
      direction_unit_vector = new Vector2(this.p2.pos.x - this.p1.pos.x, this.p2.pos.y - this.p1.pos.y).unit_vector();
      if (this.p2.fixed && !this.p1.fixed) {
        this.p1.pos = this.p1.pos.add(direction_unit_vector.scale(deltad));
      } else if (this.p1.fixed && !this.p2.fixed) {
        this.p2.pos = this.p2.pos.add(direction_unit_vector.scale(-deltad));
      } else if (!this.p2.fixed && !this.p1.fixed) {
        deltad1 = deltad * this.p1.mass / (this.p1.mass + this.p2.mass);
        deltad2 = deltad * this.p2.mass / (this.p1.mass + this.p2.mass);
        this.p1.pos = this.p1.pos.add(direction_unit_vector.scale(deltad2));
        this.p2.pos = this.p2.pos.add(direction_unit_vector.scale(-deltad1));
      }
    }

  }

  has_broken() {
    let delta,
      strain;
    if (this.breakable) {
      delta = this.current_distance - this.distance;
      strain = Math.abs(delta) / this.distance;
      if (strain > this.breaking_strain) {
        return true;
      }
    } else {
      return false;
    }
  }

}

class ParticleContactConstraint extends DistanceConstraint {

  constructor(p1, p2) {
    super(p1, p2, p1.radius + p2.radius, 1.0);
    this.lifetime = this.age;
    this.stiffness = 0.9;
  }

  enforce(constraint_solver_iterations) {
    let adjusted_stiffness,
      delta,
      deltad,
      deltad1,
      deltad2,
      direction_unit_vector;
    this.current_distance = this.p2.pos.distance_from(this.p1.pos);
    // Model as an inequality constraint, i.e. only enforce if the distance is less than the constraint distance
    if (this.current_distance <= this.distance) {
      delta = this.current_distance - this.distance;
      adjusted_stiffness = 1 - Math.pow(1 - this.stiffness, 1 / constraint_solver_iterations);
      deltad = (this.current_distance - this.distance) * adjusted_stiffness;
      direction_unit_vector = new Vector2(this.p2.pos.x - this.p1.pos.x, this.p2.pos.y - this.p1.pos.y).unit_vector();
      if (this.p2.fixed && !this.p1.fixed) {
        this.p1.pos = this.p1.pos.add(direction_unit_vector.scale(deltad));
      } else if (this.p1.fixed && !this.p2.fixed) {
        this.p2.pos = this.p2.pos.add(direction_unit_vector.scale(-deltad));
      } else if (!this.p2.fixed && !this.p1.fixed) {
        deltad1 = deltad * this.p1.mass / (this.p1.mass + this.p2.mass);
        deltad2 = deltad * this.p2.mass / (this.p1.mass + this.p2.mass);
        this.p1.pos = this.p1.pos.add(direction_unit_vector.scale(deltad2));
        this.p2.pos = this.p2.pos.add(direction_unit_vector.scale(-deltad1));
      }
    }
  }

}

class PointConstraint extends AbstractConstraint {

  constructor(p1, x, y, stiffness) {
    super();
    this.p1 = p1;
    this.stiffness = stiffness;
    this.anchor = new Vector2(x, y);
  }

  enforce(constraint_solver_iterations) {
    let adjusted_stiffness,
      current_distance,
      deltad,
      direction_unit_vector,
      strain;
    current_distance = this.p1.pos.distance_from(this.anchor);
    if (current_distance !== 0) {
      adjusted_stiffness = 1 - Math.pow(1 - this.stiffness, 1 / constraint_solver_iterations);
      deltad = current_distance * adjusted_stiffness;
      direction_unit_vector = new Vector2(this.p1.pos.x - this.anchor.x, this.p1.pos.y - this.anchor.y).unit_vector();
      this.p1.pos = this.p1.pos.add(direction_unit_vector.scale(-deltad));
    }
  }

  has_broken() {
    let current_distance = this.p1.pos.distance_from(this.anchor);
    if (current_distance !== 0) {
      let strain = Math.abs(current_distance);
      if (this.breakable && (strain > this.breaking_strain)) {
        return true;
      }
    }

  }

}

class Grid {

  constructor(grid_size, width, height) {
    this.grid_size = grid_size;
    this.grid_size_squared = this.grid_size * this.grid_size;
    this.grid_count_x = Math.ceil(width / this.grid_size);
    this.grid_count_y = Math.ceil(height / this.grid_size);
    this.elements = [];
    for (let i = 0; i < this.grid_count_x; i++) {
      this.elements[i] = new Array(this.grid_count_y);
      for (let j = 0; j < this.grid_count_y; j++) {
        this.elements[i][j] = { particles: [], size: 0 };
      }
    }
  }

  add_item(particle) {
    let grid_index_x = Math.floor(particle.pos.x / this.grid_size);
    let grid_index_y = Math.floor(particle.pos.y / this.grid_size);
    if (grid_index_x < 0) {
      grid_index_x = 0;
    } else if (grid_index_x > (this.grid_count_x - 1)) {
      grid_index_x = this.grid_count_x - 1;
    }
    if (grid_index_y < 0) {
      grid_index_y = 0;
    }
    else if (grid_index_y > (this.grid_count_y - 1)) {
      grid_index_y = this.grid_count_y - 1;
    }
    if (this.elements[grid_index_x][grid_index_y].particles.length < this.elements[grid_index_x][grid_index_y].size) {
      this.elements[grid_index_x][grid_index_x].particles.push(particle);
    } else {
      this.elements[grid_index_x][grid_index_y].particles[this.elements[grid_index_x][grid_index_y].size] = particle;
    }
    this.elements[grid_index_x][grid_index_y].size = this.elements[grid_index_x][grid_index_y].size + 1;
  }

  clear() {
    for (let i = 0; i < this.grid_count_x; i++) {
      for (let j = 0; j < this.grid_count_y; j++) {
        this.elements[i][j].size = 0; // Don't clear array, just overwrite and keep track of virtual end of array
      }
    }
  }

  retrieve_items(p) {
    let x = Math.floor(p.pos.x / this.grid_size);
    let y = Math.floor(p.pos.y / this.grid_size);
    if (x < 0) {
      x = 0;
    } else if (x > (this.grid_count_x - 1)) {
      x = this.grid_count_x - 1;
    }
    if (y < 0) {
      y = 0;
    } else if (y > (this.grid_count_y - 1)) {
      y = this.grid_count_y - 1;
    }
    for (let i = 0; i < this.elements[x][y].size; i++) {
      let distance_apart_squared = Math.pow(p.pos.x - this.elements[x][y].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x][y].particles[i].pos.y, 2);
      if (distance_apart_squared < this.grid_size_squared) {
        p.SPH_neighbours.push(this.elements[x][y].particles[i]);
      }
    }
    let x_limit_min = (x == 0);
    let x_limit_max = (x == (this.grid_count_x - 1));
    let y_limit_min = (y == 0);
    let y_limit_max = (y == (this.grid_count_y - 1));
    if (!x_limit_min) {
      for (let i = 0; i < this.elements[x - 1][y].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x - 1][y].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x - 1][y].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x - 1][y].particles[i]);
        }
      }
    }
    if (!x_limit_max) {
      for (let i = 0; i < this.elements[x + 1][y].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x + 1][y].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x + 1][y].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x + 1][y].particles[i]);
        }
      }
    }
    if (!y_limit_min) {
      for (let i = 0; i < this.elements[x][y - 1].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x][y - 1].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x][y - 1].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x][y - 1].particles[i]);
        }
      }
    }
    if (!y_limit_max) {
      for (let i = 0; i < this.elements[x][y + 1].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x][y + 1].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x][y + 1].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x][y + 1].particles[i]);
        }
      }
    }
    if (!y_limit_max && !x_limit_max) {
      for (let i = 0; i < this.elements[x + 1][y + 1].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x + 1][y + 1].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x + 1][y + 1].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x + 1][y + 1].particles[i]);
        }
      }
    }
    if (!y_limit_min && !x_limit_max) {
      for (let i = 0; i < this.elements[x + 1][y - 1].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x + 1][y - 1].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x + 1][y - 1].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x + 1][y - 1].particles[i]);
        }
      }
    }
    if (!y_limit_min && !x_limit_min) {
      for (let i = 0; i < this.elements[x - 1][y - 1].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x - 1][y - 1].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x - 1][y - 1].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x - 1][y - 1].particles[i]);
        }
      }
    }
    if (!y_limit_max && !x_limit_min) {
      for (let i = 0; i < this.elements[x - 1][y + 1].size; i++) {
        let distance_apart_squared = Math.pow(p.pos.x - this.elements[x - 1][y + 1].particles[i].pos.x, 2) + Math.pow(p.pos.y - this.elements[x - 1][y + 1].particles[i].pos.y, 2);
        if (distance_apart_squared < this.grid_size_squared) {
          p.SPH_neighbours.push(this.elements[x - 1][y + 1].particles[i]);
        }
      }
    }
  }
}


class SpatialHash { // This spatial hash implementation is a work in progress (not very performant at this time) 

  constructor(bin_size) {
    this.spatial_hash = {};
    this.size = 0;
    this.bin_size = bin_size;
    this.bin_size_squared = this.bin_size * this.bin_size;
  }

  add_item(p) {
    let bin_index_x = Math.floor(p.pos.x / this.bin_size);
    let bin_index_y = Math.floor(p.pos.y / this.bin_size);
    let key = bin_index_x + "," + bin_index_y;
    if (this.spatial_hash[key] == undefined) {
      this.spatial_hash[key] = [];
      this.size++;
    }
    this.spatial_hash[key].push(p);
  }

  get_x_index(x) {
    return Math.floor(x / this.bin_size);
  }

  get_y_index(y) {
    return Math.floor(y / this.bin_size);
  }

  retrieve_key(x, y) {
    let bin_index_x = Math.floor(x / this.bin_size);
    let bin_index_y = Math.floor(y / this.bin_size);
    return (get_x_index(bin_index_x) + "," + get_y_index(bin_index_y));
  }

  retrieve_items(p) {
    let bin_index_x = Math.floor(p.pos.x / this.bin_size);
    let bin_index_y = Math.floor(p.pos.y / this.bin_size);
    let keys = [];
    keys.push(bin_index_x + "," + bin_index_y);
    keys.push((bin_index_x - 1) + "," + bin_index_y);
    keys.push((bin_index_x + 1) + "," + bin_index_y);
    keys.push(bin_index_x + "," + (bin_index_y + 1));
    keys.push(bin_index_x + "," + (bin_index_y - 1));
    keys.push((bin_index_x + 1) + "," + (bin_index_y + 1));
    keys.push((bin_index_x - 1) + "," + (bin_index_y + 1));
    keys.push((bin_index_x + 1) + "," + (bin_index_y - 1));
    keys.push((bin_index_x - 1) + "," + (bin_index_y - 1));
    for (let i = 0; i < keys.length; i++) {
      if (this.spatial_hash[keys[i]] !== undefined) {
        for (let j = 0; j < this.spatial_hash[keys[i]].length; j++) {
          let distance_apart_squared = Math.pow(p.pos.x - this.spatial_hash[keys[i]][j].pos.x, 2) + Math.pow(p.pos.y - this.spatial_hash[keys[i]][j].pos.y, 2);
          if (distance_apart_squared < this.bin_size_squared) {
            p.SPH_neighbours.push(this.spatial_hash[keys[i]][j]);
          }
        }
      }
    }
  }

  clear() {
    this.spatial_hash = {};
    this.size = 0;
  }

}

class PhysicsWorld {

  constructor(width, height, time_step, constraint_solver_iterations) {
    this.width = width;
    this.height = height;
    this.time_step = time_step;
    this.particles = [];
    this.constraints = [];
    this.collisions = [];
    this.boundaries = [];
    this.time = 0;
    this.steps = 0;
    this.gravitational_field = new Vector2(0, -9.81);
    this.constraint_solver_iterations = constraint_solver_iterations;
    this.simple_world_boundary_collisions = true;
    this.damping_coefficient = 0.00; // Not used for now
    this.particle_to_particle_collisions = true;
    this.particle_contact_radius = 0.1;
    this.SPH_spatial_partitioning = 1; // 0 = off, 1 = grid, 2 = spatial hash
    this.SPH_grid = null;
    this.SPH_smoothing_length = 1.0;
    if (this.SPH_spatial_partitioning == 1) {
      this.SPH_grid = new Grid(this.SPH_smoothing_length, this.width, this.height);
    }
    if (this.SPH_spatial_partitioning == 2) {
      this.SPH_grid = new SpatialHash(this.SPH_smoothing_length);
    }
    this.SPH_rest_density = 1000;
    this.SPH_k = 16;
    this.SPH_u = 35;
    this.SPH_sigma_density = 315 / (64 * PI * Math.pow(this.SPH_smoothing_length, 9));
    this.SPH_sigma_pressure = -45 / (Math.PI * Math.pow(this.SPH_smoothing_length, 6));
    this.SPH_sigma_viscosity = 45 / (Math.PI * Math.pow(this.SPH_smoothing_length, 6));
  }

  create_particle(px, py, vx, vy, ax, ay, fx, fy, mass, radius, fixed) {
    this.particles.push(new Particle(px, py, vx, vy, ax, ay, fx, fy, mass, radius, fixed));
  }

  create_distance_constraint(p1, p2, distance, stiffness) {
    if (distance == null) {
      distance = p2.pos.distance_from(p1.pos);
    }
    if (stiffness == null) {
      stiffness = 0.9;
    }
    this.constraints.push(new DistanceConstraint(p1, p2, distance, stiffness));
  }

  create_point_constraint(p1, x, y, stiffness) {
    if (x == null) {
      x = p1.pos.x;
    }
    if (y == null) {
      y = p1.pos.y;
    }
    if (stiffness == null) {
      stiffness = 0.9;
    }
    this.constraints.push(new PointConstraint(p1, x, y, stiffness));
  }

  create_particle_contact_constraint(p1, p2) {
    this.constraints.push(new ParticleContactConstraint(p1, p2));
  }

  delete_particle_by_index(count) {
    // If particle was part of a constraint, delete the constraint too
    let p1 = this.particles[count];
    let number_of_iterations = this.constraints.length;
    for (let i = 0; i < number_of_iterations; i++) {
      if (this.constraints[i] instanceof DistanceConstraint) {
        if ((this.constraints[i].p2 === p1) || (this.constraints[i].p1 === p1)) {
          if (i == (this.constraints.length - 1)) {
            this.delete_constraint_by_index(i);
            number_of_iterations--;
          } else {
            this.delete_constraint_by_index(i);
            number_of_iterations--;
            i--;
          }
        }
      } else if (this.constraints[i] instanceof PointConstraint) {
        if (this.constraints[i].p1 === p1) {
          if (i == (this.constraints.length - 1)) {
            this.delete_constraint_by_index(i);
            number_of_iterations--;
          } else {
            this.delete_constraint_by_index(i);
            number_of_iterations--;
            i--;
          }
        }
      }
    }
    this.particles.splice(count, 1);
  }

  delete_particle_by_reference(p1) {
    let count = this.particles.indexOf(p1);
    this.delete_particle_by_index(count);
  }

  delete_constraint_by_index(count) {
    this.constraints.splice(count, 1);
  }

  delete_constraint_by_reference(c1) {
    let count = this.constraints.indexOf(c1);
    this.delete_constraint_by_index(count);
  }

  update() {
    this.clean_up();
    this.accumulate_forces();
    this.collision_detection_and_response();
    this.constraint_resolution();
    this.integrate();
    this.time = this.time + this.time_step;
    this.steps = this.steps + 1;
  }

  clean_up() {
    if (this.SPH_spatial_partitioning > 0) {
      this.SPH_grid.clear();
    }
    // Clear all collisions
    this.collisions.length = 0;
    // Increase age, check for end of life, delete if necessary
    let number_of_iterations = this.constraints.length;
    for (let i = 0; i < number_of_iterations; i++) {
      this.constraints[i].age = this.constraints[i].age + 1;
      if (this.constraints[i].has_life_expired()) {
        if (i == (this.constraints.length - 1)) {
          this.delete_constraint_by_index(i);
          number_of_iterations--;
        } else {
          this.delete_constraint_by_index(i);
          number_of_iterations--;
          i--;
        }
      }
    }
    // Increase age, check for end of life, delete if necessary
    number_of_iterations = this.particles.length;
    for (let i = 0; i < number_of_iterations; i++) {
      // Increase age of particles and check for end of life
      this.particles[i].age = this.particles[i].age + 1;
      //this.particles[i].check_lifetime();
      if (this.particles[i].has_life_expired()) {
        if (i == (this.particles.length - 1)) {
          this.delete_particle_by_index(i);
          number_of_iterations--;
        } else {
          this.delete_particle_by_index(i);
          number_of_iterations--;
          i--;
        }
      } else {
        // Reset force to zero
        this.particles[i].force.set_to_zero();
        // Reset acceleration to zero
        this.particles[i].acc.set_to_zero();
        // set fluid densities to zero
        this.particles[i].SPH_density = 0;
        this.particles[i].SPH_neighbours = [];
      }
    }
  }

  accumulate_forces() {
    this.calculate_gravitational_field_forces();
    this.calculate_fluid_forces();
  }

  constraint_resolution() {
    // Enforce all constraints, repeat for as many constraint solver iterations have been specified
    for (let i = 0; i < this.constraint_solver_iterations; i++) {
      // Enforce constraints
      for (let constraint of this.constraints) {
        constraint.enforce(this.constraint_solver_iterations);
      }
    }

    // Apply restitution (particle-boundary)
    for (let particle of this.particles){
      particle.calculate_velocity(this.time_step);
      if (this.simple_world_boundary_collisions) {
        if (particle.pos.y + particle.radius > this.height) {
          particle.vel.y = -particle.coefficient_of_restitution * particle.vel.y;
          particle.pos.y = this.height - particle.radius;
        } else if (particle.pos.y - particle.radius < 0) {
          particle.vel.y = -particle.coefficient_of_restitution * particle.vel.y;
          particle.pos.y = 0 + particle.radius;
        }
        if (particle.pos.x + particle.radius > this.width) {
          particle.vel.x = -particle.coefficient_of_restitution * particle.vel.x;
          particle.pos.x = this.width - particle.radius;
        } else if (particle.pos.x - particle.radius < 0) {
          particle.vel.x = -particle.coefficient_of_restitution * particle.vel.x;
          particle.pos.x = 0 + particle.radius;
        }
        particle.pos_previous = particle.pos.subtract(particle.vel.scale(this.time_step));
      }
    }

    // Check whether constraint has broken, if so, delete
    let number_of_iterations = this.constraints.length;
    for (let i = 0; i < number_of_iterations; i++) {
      if (this.constraints[i].has_broken()) {
        if (i == (this.constraints.length - 1)) {
          this.delete_constraint_by_index(i);
          number_of_iterations--;
        } else {
          this.delete_constraint_by_index(i);
          number_of_iterations--;
          i--;
        }
      }
    }
  }

  collision_detection_and_response() {
    let particle_index = 0;
    let particle2_index = 0;
    for (let particle of this.particles) {
      // Only proceed if a particle is allowed to collide
      if (particle.collides) {
        // First check for particle-particle collisions (but only proceed if current particle is allowed to collide with another particle)
        if (this.particle_to_particle_collisions) {
          particle2_index = 0;
          for (let particle2 of this.particles) {
            if (particle2_index > particle_index) {
              if ((Math.pow(this.particles[particle_index].pos.x - this.particles[particle2_index].pos.x, 2) + Math.pow(this.particles[particle_index].pos.y - this.particles[particle2_index].pos.y, 2)) < Math.pow(this.particles[particle_index].radius + this.particles[particle2_index].radius, 2)) {
                // A particle-particle collision has been detected, create a contact constraint
                this.create_particle_contact_constraint(this.particles[particle_index], this.particles[particle2_index]);
              }
            }
            particle2_index++;
          }
        }
      }
      particle_index++;
    }
  }

  calculate_gravitational_field_forces() {
    // Apply gravitational field accelerations (not forces)
    for (let particle of this.particles) {
      particle.acc = particle.acc.add(this.gravitational_field);
    }
  }

  calculate_fluid_forces() {

    // Find fluid neighbours

    if (this.SPH_spatial_partitioning > 0) {
      // Populate the spatial data structure
      for (let i = 0; i < this.particles.length; i++) {
        if (this.particles[i].SPH_particle) {
          this.SPH_grid.add_item(this.particles[i]);
        }
      }
      // Query the spatial data structure for neighbours
      for (let i = 0; i < this.particles.length; i++) {
        this.SPH_grid.retrieve_items(this.particles[i]);
      }
    } else {
      // Perform a naive O(N^2) based search
      let particle_index = 0;
      let particle2_index = 0;
      for (let i = 0; i < this.particles.length; i++) {
        this.particles[i].SPH_neighbours = [];
        if (this.particles[i].SPH_particle == true) {
          particle2_index = 0;
          for (let j = 0; j < this.particles.length; j++) {
            if (particle2_index >= particle_index) {
              if (this.particles[j].SPH_particle == true) {
                let distance_apart_squared = Math.pow(this.particles[i].pos.x - this.particles[j].pos.x, 2) + Math.pow(this.particles[i].pos.y - this.particles[j].pos.y, 2);
                let SPH_smoothing_length_squared = Math.pow(this.SPH_smoothing_length, 2);
                if (distance_apart_squared < SPH_smoothing_length_squared) {
                  this.particles[i].SPH_neighbours.push(this.particles[j]);
                }
              }
            }
            particle2_index++;
          }
        }
      }
    }

    // This initial fluid simulation implementation, using smoothed particle hydrodynamics (SPH), was generally based on the concepts outlined in the paper: Particle-based fluid simulation for interactive applications (Matthias Müller, David Charypar and Markus Gross) http://matthias-mueller-fischer.ch/publications/sca03.pdf

    // Calculate fluid densities and pressures

    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].SPH_particle == true) {
        if (this.particles[i].SPH_neighbours.length > 0) {
          for (let j = 0; j < (this.particles[i].SPH_neighbours.length); j++) {
            let distance_apart_squared = Math.pow(this.particles[i].pos.x - this.particles[i].SPH_neighbours[j].pos.x, 2) + Math.pow(this.particles[i].pos.y - this.particles[i].SPH_neighbours[j].pos.y, 2);
            // W_density = 315 / (64 * pi * h ^ 9) * (h ^ 2 - r ^ 2) ^ 3 based on referenced paper
            // To-do: Renormalise this for a 2D domain
            // The "sigma" portion of the smoothing function is pre-computed
            let weight = this.SPH_sigma_density * Math.pow(this.SPH_smoothing_length * this.SPH_smoothing_length - distance_apart_squared, 3);
            this.particles[i].SPH_density = this.particles[i].SPH_density + (weight * this.particles[i].SPH_neighbours[j].mass);
          }
        }
        // Clamp minimum pressure value to prevent tensile instability (ie prevent negative pressure)
        if (this.particles[i].SPH_density < this.SPH_rest_density) {
          this.particles[i].SPH_density = this.SPH_rest_density;
        }
        this.particles[i].SPH_pressure = this.SPH_k * (this.particles[i].SPH_density - this.SPH_rest_density);
      }
    }

    // Calculate pressure forces and viscosity forces

    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].SPH_particle == true) {
        for (let j = 0; j < this.particles[i].SPH_neighbours.length; j++) {
          if (this.particles[i] !== this.particles[i].SPH_neighbours[j]) {
            let distance_apart_squared = Math.pow(this.particles[i].pos.x - this.particles[i].SPH_neighbours[j].pos.x, 2) + Math.pow(this.particles[i].pos.y - this.particles[i].SPH_neighbours[j].pos.y, 2);
            if (distance_apart_squared > 0) { // Todo: find elegant way to handle co-located particles
              // W_pressure = 15 / (PI * h ^ 6) * (h - r) ^ 3 based on referenced paper
              // We need the gradient of W_pressure. W_pressure_gradient = -45 / (PI * h ^ 6) * (h - r) ^ 2 based on simple algebra
              // To-do: Renormalise this for a 2D domain
              let weight_pressure = this.SPH_sigma_pressure * Math.pow(this.SPH_smoothing_length - Math.sqrt(distance_apart_squared), 2);
              let distance_apart_unit = this.particles[i].SPH_neighbours[j].pos.subtract(this.particles[i].pos).unit_vector();
              let pressure_force = this.particles[i].SPH_neighbours[j].mass * (this.particles[i].SPH_pressure + this.particles[i].SPH_neighbours[j].SPH_pressure) / (2 * this.particles[i].SPH_neighbours[j].SPH_density) * weight_pressure;
              this.particles[i].force = this.particles[i].force.add(distance_apart_unit.scale(pressure_force));
            }
            // W_viscosity = 15 / (2 * PI * h ^ 3) * (-r ^ 3 / (2 * h ^ 3) + r ^ 2 / h ^ 2 + h / (2 * r) - 1) based on referenced paper
            // We need the Laplacian of W_viscosity. W_viscosity_Laplacian = 45 / (pi * h ^ 6) * (h - r) based on referenced paper
            // Todo: Renormalise this for a 2D domain, also confirm the Laplacian independently
            // The "sigma" portion of the smoothing function is pre-computed
            let weight_viscosity = this.SPH_sigma_viscosity * (this.SPH_smoothing_length - Math.sqrt(distance_apart_squared));
            let rel_vel = this.particles[i].SPH_neighbours[j].vel.subtract(this.particles[i].vel);
            let viscosity_force_vec = rel_vel.scale(this.particles[i].SPH_neighbours[j].mass / this.particles[i].SPH_neighbours[j].SPH_density * weight_viscosity);
            this.particles[i].force = this.particles[i].force.add(viscosity_force_vec.scale(this.SPH_u));
          }
        }
      }
    }
  }

  integrate() {
    for (let particle of this.particles) {
      particle.integrate(this.time_step, this.damping_coefficient);
    }
  }

}

function create_fluid_cluster(pos_x, pos_y, angle, width, height, divisions_width, divisions_height, contact_radius, density, collides) {
  var centre = new Vector2(pos_x, pos_y);
  var particle_mass = density * width * height / (divisions_width + 1) / (divisions_height + 1);
  // Note: density is in kg / sq. m
  var spacing_width = width / divisions_width;
  var spacing_height = height / divisions_height;
  var radii = contact_radius;

  for (var count = 0; count < divisions_height + 1; count++) {
    for (var count2 = 0; count2 < divisions_width + 1; count2++) {
      physics_world.create_particle((centre.x - width / 2) + count2 * spacing_width, (centre.y + height / 2) - count * spacing_height, 0, 0, 0, 0, 0, 0, particle_mass, radii, false);
      physics_world.particles[physics_world.particles.length - 1].pos = physics_world.particles[physics_world.particles.length - 1].pos.rotate_about(centre, angle);
      physics_world.particles[physics_world.particles.length - 1].pos_previous.set_to(physics_world.particles[physics_world.particles.length - 1].pos);
      physics_world.particles[physics_world.particles.length - 1].SPH_particle = true;
      physics_world.particles[physics_world.particles.length - 1].collides = collides;
    }
  }

}