#pragma once
#include <array>
#include <vector>
namespace lab {
using Vec3 = std::array<double,3>;
struct OrbitBody { double mass; Vec3 position, velocity; };
// AU, Julian year, solar GM mass ratio. JPL DE440 solar GM and IAU AU.
constexpr double AU = 149597870700.0, YEAR = 365.25*86400.0;
constexpr double SOLAR_GM = 1.32712440041279419e20;
constexpr double ORBIT_G = SOLAR_GM*YEAR*YEAR/(AU*AU*AU);
constexpr double SOLAR_MASS = SOLAR_GM/6.67430e-11;
constexpr double ORBIT_DT = 1.0/4096;
class OrbitSystem {
public:
    std::vector<OrbitBody> bodies;
    explicit OrbitSystem(int preset, double velocityScale=1);
    explicit OrbitSystem(std::vector<OrbitBody> initial);
    void step(double dt);
    double energy() const;
    Vec3 momentum() const;
    Vec3 angularMomentum() const;
    void recenter();
private:
    std::vector<Vec3> accelerations() const;
};
double norm(const Vec3 &v);
}
