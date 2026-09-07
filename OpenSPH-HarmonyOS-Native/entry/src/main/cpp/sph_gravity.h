#pragma once
#include "system/Settings.h"
namespace lab {
// Preserve the legacy material equations. This bounded direct sum is the
// reference integration path; do not silently substitute a tree approximation.
inline void configureSphGravity(Sph::RunSettings& settings, bool enabled) {
    if (!enabled) return;
    settings.set(Sph::RunSettingsId::SPH_SOLVER_FORCES,
        settings.getFlags<Sph::ForceEnum>(Sph::RunSettingsId::SPH_SOLVER_FORCES) | Sph::ForceEnum::SELF_GRAVITY);
    settings.set(Sph::RunSettingsId::GRAVITY_SOLVER, Sph::GravityEnum::BRUTE_FORCE);
    settings.set(Sph::RunSettingsId::GRAVITY_KERNEL, Sph::GravityKernelEnum::SPH_KERNEL);
    settings.set(Sph::RunSettingsId::GRAVITY_RECOMPUTATION_PERIOD, Sph::Float(0));
}
}
