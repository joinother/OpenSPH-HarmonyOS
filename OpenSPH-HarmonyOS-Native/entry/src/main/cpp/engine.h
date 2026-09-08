#pragma once
#include "sph_fragments.h"
#include "orbit.h"
#include "sph_diagnostics.h"
#include "preparation.h"
#include <atomic>
#include <condition_variable>
#include <deque>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace lab {
struct OrbitSpec {
    std::string name;
    double massSolar, xAU, yAU, zAU, vxKmS, vyKmS, vzKmS;
    int surface;
    double radiusKm=0;
};
struct Config {
    int preset = 0, count = 600;
    double speed = 5, angle = 0, duration = 60;
    double targetRadiusKm = 100, impactorRadiusKm = 60;
    double targetDensity = 2700, impactorDensity = 2700;
    double targetSpin = 0;
    int seed = 1234;
    std::vector<OrbitSpec> orbitBodies;
    bool selfGravity = false;
    double relaxationSeconds = 0;
};
bool validConfig(const Config &c);
struct Particle {
    float x, y, z, speed, density, body;
};
struct Frame {
    OrbitContact contact;std::vector<double> radiiAU;
    SphFragments fragments;
    SphDiagnostics sph;
    std::vector<SphScalar> scalars;
    std::vector<Particle> particles;
    bool orbital = false;
    std::vector<int> surfaces;
    std::vector<Particle> trails; // contiguous per body, at most 512 samples each
    double energyError = 0, angularError = 0;
    double time = 0, maxSpeed = 0, meanDensity = 0, totalMass = 0;
    double centers[6] = {};
};
struct Status {
    OrbitContact contact;
    PreparationStatus preparation;
    SphDiagnostics sph;
    std::string state = "empty", error;
    int count = 0, frames = 0, selected = -1;
    double time = 0, duration = 60, stepMs = 0, maxSpeed = 0, meanDensity = 0;
    int steps = 0;
    Config config;
    bool configKnown = true;
    double totalMass = 0;
    double energyError = 0, angularError = 0;
    std::vector<Particle> bodies;
};
struct ObservationSample { int frame; double time, distanceAU, speedKmS; };
struct OrbitObservation {
    uint64_t sceneRevision=0;
    int body=1, selected=-1;
    std::string name;
    std::vector<ObservationSample> samples;
};
struct SphObservationSample {int frame;double time;std::array<double,10> values;SphStructure structure;};
struct SphObservation {uint64_t sceneRevision=0;int selected=-1;std::vector<SphObservationSample> samples;};
struct FragmentFrame {uint64_t sceneRevision=0;int selected=-1;std::shared_ptr<const Frame> frame;};
class Engine {
  public:
    Engine();
    ~Engine();
    void start(Config config, bool initiallyPaused = false);
    void pause(bool paused);
    void pauseOnContact(uint64_t request);
    void cancel();
    void seek(int index);
    Status status();
    OrbitObservation observation(int body);
    SphObservation sphObservation();
    FragmentFrame fragmentFrame();
    void seekSphObservation(int index,uint64_t revision,double time);
    void seekObservation(int index, uint64_t revision, double time);
    std::shared_ptr<const Frame> frame();
    uint64_t sceneRevision() const { return generation.load(); }
    bool saveReplay(const std::string &directory,bool includeFragments=true);
    bool loadReplay(const std::string &directory);
    static Engine &instance();
    // Solver-thread only callbacks. No ArkTS objects cross this boundary.
    bool stopped(uint64_t generation) const;
    bool waitUntilRunning(uint64_t generation);
    // Cooperative cancellation points between expensive construction phases.
    bool preparationStage(uint64_t generation,const std::string& stage);
    void publish(std::shared_ptr<Frame> frame, uint64_t generation, double stepMs);

  private:
    void loop();
    std::mutex mutex;
    std::condition_variable cv;
    std::atomic<uint64_t> generation{0};
    std::atomic<bool> quit{false};
    bool pending = false, paused = false;
    PreparationTracker preparation;
    uint64_t workerRequestId=0;
    std::string workerStage="idle";
    Config config;
    Status current;
    std::deque<std::shared_ptr<Frame>> history;
    static constexpr size_t maxFrames = 240;
    std::thread worker;
};
} // namespace lab
