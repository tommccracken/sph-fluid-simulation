/*

  SPH Fluid Simulation - Demonstration App Scenes

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

const scenes = [

  [

    name = "Fluid-column-wall",

    loader = function () {
      physics_frequency = 100;
      physics_period = 1 / physics_frequency;
      world_size= 10;
      physics_world = new PhysicsWorld(world_size, world_size, physics_period, 10);
      physics_world.gravitational_field.y = -9.81;
      create_fluid_cluster(3, 5, 0, 5, 7, 15, 25, physics_world.particle_contact_radius, 1000, true);
      physics_world.create_particle(6.5, 0.5, 0, 0, 0, 0, 0, 0, 1500, 0.5, true);
      physics_world.create_particle(6.5, 1.5, 0, 0, 0, 0, 0, 0, 1500, 0.5, true);
      physics_world.create_particle(6.5, 2.5, 0, 0, 0, 0, 0, 0, 1500, 0.5, true);
      physics_world.create_particle(6.5, 3.5, 0, 0, 0, 0, 0, 0, 1500, 0.5, true);
    }

  ],

  [

    name = "Fluid-double-columns",

    loader = function () {
      physics_frequency = 100;
      physics_period = 1 / physics_frequency;
      world_size = 10;
      physics_world = new PhysicsWorld(world_size, world_size, physics_period, 10);
      physics_world.gravitational_field.y = -9.81;
      create_fluid_cluster(1.5, 6, 0, 3, 6, 9, 18, physics_world.particle_contact_radius, 800, false);
      create_fluid_cluster(7, 6, 0, 3, 6, 9, 18, physics_world.particle_contact_radius, 800, false);
    }

  ],

  [

    name = "Fluid-1024-particles",

    loader = function () {
      physics_frequency = 100;
      physics_period = 1 / physics_frequency;
      world_size = 10;
      physics_world = new PhysicsWorld(world_size, world_size, physics_period, 10);
      physics_world.gravitational_field.y = -9.81;
      create_fluid_cluster(5, 5, 0.1, 8, 8, 32, 32, physics_world.particle_contact_radius, 1000, false);
    }

  ],

  [

    name = "Fluid-1600-particles",

    loader = function () {
      physics_frequency = 100;
      physics_period = 1 / physics_frequency;
      world_size = 10;
      physics_world = new PhysicsWorld(world_size, world_size, physics_period, 10);
      physics_world.gravitational_field.y = -9.81;
      create_fluid_cluster(5, 5, 0.1, 8, 8, 40, 40, physics_world.particle_contact_radius, 1000, false);
    }

  ],

  [

    name = "Fluid-waves",

    loader = function () {
      physics_frequency = 100;
      physics_period = 1 / physics_frequency;
      world_size = 10;
      physics_world = new PhysicsWorld(world_size, world_size, physics_period, 10);
      physics_world.gravitational_field.y = 0;
      create_fluid_cluster(5, 5, 0, 9, 9, 27, 27, physics_world.particle_contact_radius, 1000, false);
      create_fluid_cluster(2.3, 5, 0, 2, 2, 6, 6, physics_world.particle_contact_radius, 1000, false);
    }

  ],

  [

    name = "Fluid-buoyancy",

    loader = function () {
      physics_frequency = 100;
      physics_period = 1 / physics_frequency;
      world_size = 10;
      physics_world = new PhysicsWorld(world_size, world_size, physics_period, 10);
      physics_world.gravitational_field.y = -9.81;
      physics_world.SPH_target_density = 1000;
      create_fluid_cluster(5, 2.7, 0, 9, 5, 25, 18, physics_world.particle_contact_radius, 1000, true);
      physics_world.create_particle(8, 8, 0, 0, 0, 0, 0, 0, 200, 0.5, false);
      physics_world.create_particle(5, 8, 0, 0, 0, 0, 0, 0, 1500, 0.5, false);
      physics_world.create_particle(2, 8, 0, 0, 0, 0, 0, 0, 5000, 0.5, false);
    }

  ],

];