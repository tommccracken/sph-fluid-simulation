# SPH Fluid Simulation

A fluid simulation web experiment based on smoothed particle hydrodynamics.

[Link ](https://tommccracken.github.io/sph-fluid-simulation/) to demonstration.

## Introduction

The aim of this project is to develop a fluid simulation web experiment based on smoothed particle hydrodynamics  ([SPH](https://en.wikipedia.org/wiki/Smoothed-particle_hydrodynamics)).

Most fluid simulations are centered around solving the Navier–Stokes equations for the motion of viscous fluids. These simulations are generally based on one of the following methods:
- Eulerian "grid" based methods
- Lagrangian "particle" based methods (eg SPH)
- Hybrid methods (eg FLIP, MPM)

This simulation uses SPH, a "particle" method, to calculate fluid densities, pressures and fluid forces (pressure force and viscosity force). The fluid particles are advected based on these forces using a position based "Verlet" numerical time integration scheme.

The density and force calculations used in this SPH implementation are generally based on [this](http://matthias-mueller-fischer.ch/publications/sca03.pdf) paper. Note: The surface tension force described in the paper has not been implemented at this time.

## SPH method overview
SPH is a computational method for simulating continuum mechanics. In this simulation the fluid is discretised as a collection of particles. A physical quantity of the fluid, at a particular particle, can be determined by summing the weighted relevant properties of all neighbouring particles. The weighting is achieved using a kernel function with a range proportional to the characteristic smoothing length. The smoothing kernels implemented for this simulation have a range exactly equal to the smoothing length. This is computationally advantageous as it avoids square root operations. The following key steps are involved in the simulation:

    Apply initial conditions
    Loop while simulating
        For all particles
            Find neighbours
        For all particles
            Calculate density using SPH
            Approximate pressure from density
        For all particles
            Calculate pressure force using SPH
            Calculate viscosity force using SPH
            Apply gravity force
        Collision detection and response
        Time integration
        Render scene

*Note: The core logic of this standalone fluid simulation project was originally developed as part of an update to the particle based physics engine [jsRubble](https://tommccracken.net/jsRubble/). Some additional functionality from jsRubble has also been included to enable richer demonstration scenes. This includes a constraint solver (with support for distance, point and contact constraints) and a main loop with decoupled physics and rendering updates.*

The particles are advected based on the calculated forces using the [Verlet](https://en.wikipedia.org/wiki/Verlet_integration#Basic_St%C3%B6rmer%E2%80%93Verlet) integration scheme. This approach makes position based constraints trivial to implement.

## Neighbour search
A key part of the SPH method, and a significant contributor to simulation computational cost, involves searching for a particle's neighbours. Due to the selected kernel functions described above, the neighbour search needs to identify all particles within a circle with a radius equal to the smoothing length.

One simple but naive approach to this involves checking each particle against every other particle. (time complexity of ON²). Whilst this might be adequate for simulations involving relatively small numbers of particles, a more sophisticated approach would be required as particle count increases.

Spatial partitioning can improve performance by reducing the number of particle nieghbour pair checks. This simulation implements a "grid" based scheme where the domain is divided up into a collection of "bins" using a high level grid construct. The grid extends across the entire domain and is determined at the beginning of the simulation based on the selected SPH smoothing length (ie bin height/width equals smoothing length). The initial stage of performing a neighbour search involves iterating over all particles and determining what bin each particle resides within. After this process, a neighbour search for a particular particle only needs to consider particles located within the bins immediately adjacent to the particle.

Another approach might involve using a spatial hash. Similar to the grid method, the spatial hash divides the domain up into "bins". Rather that attaching fixed bins to a fixed grid, a spatial hash uses a hash table to store a list of particles in a dictionary where the x and y co-ordinate of the bin makes up the key to the value. This approach enables the spatial hash to grow and shrink to encompass only the portions of the domain that are occupied by particles. This data structure aligns with one of the inherent advantages of particle based methods, ie that the fluid can travel within a nearly "infinite" domain (limited by computer science constraints).

Once the number of particles reaches a certain tipping point, the overhead computational cost of applying a spatial partitioning technique will be offset by the significantly reduced time complexity associated with checking a much smaller subset of the collection of particles.

## Rendering
This project uses a simple approach to rendering.

The contact radius of each particle (ie the radius at which a particle can contact another particle or a world boundary) is rendered as a dark blue circle.

The smoothing length of each particle is represented as a blue circle with a translucency gradient that approaches full transparency at the smoothing length.

Fixed non-fluid particles are rendered as red circles, dynamic non-fluid particles are rendered as green circles.

A "debug draw" mode can also be activated which displays contact constraints, particle numbers, a representation of the spatial partitioning scheme and more definitive particle smoothing length circumferences.