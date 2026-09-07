#pragma once
#include <string>
#include "ring_trace.h"
#include <cstdint>
#include <memory>
#include "sky_panorama.h"
#include "moon_map.h"
#include "surface_generator.h"
namespace lab {void setMoonMap(std::shared_ptr<const MoonMap> map);}
#include "projection.h"
#include "camera_navigation.h"
#include "fragment_follow.h"
#include <ace/xcomponent/native_interface_xcomponent.h>
namespace lab {
struct SkySettings { int mode=2; float brightness=.65f; };
void setSkyPanorama(std::shared_ptr<const SkyPanorama> panorama);
void setSky(int mode,float brightness);
void setComposition(float x,float y,float scale);
struct MaterialSettings { float exposure=0; bool ocean=true,cloudShadows=true; };
void setMaterial(float exposure,bool ocean,bool cloudShadows);
struct Appearance { bool clouds=true, atmosphere=true, trails=true, closeup=false, autoSpin=false,rings=true; };
void setSurfaceSeeds(const std::array<SurfaceKey,8> &keys);
struct RenderStatus { FragmentFollowStatus fragmentFollow; int surfacePending=0,surfaceGenerated=0;std::string surfaceError; bool moonReady=false; int moonUploads=0; float moonBlend=0; std::string moonError; float materialExposure=0; bool materialOcean=true,materialCloudShadows=true; uint64_t sceneRevision=0; int surfaceStarts=0; bool cameraMoving=false; float centerX=0,centerY=0,centerZ=0; float compositionX=.5f,compositionY=.5f,compositionScale=1; bool panoramaReady=false; float panoramaBlend=0; bool skyReady=false; float skyStars=0,skyGalaxy=0; bool ready=false, texturesReady=false, active=true; int frames=0; double submitMs=0, previewSeconds=0; std::string error; };
struct ProjectedScene { bool ready=false; int width=0,height=0; double time=0; std::vector<ProjectedBody> bodies; };
ProjectedScene projectedScene();
void configureRingTrace(bool enabled,bool running,int target,double mass);
void seekRingTrace(double seconds);
void setRingDisturbance(double impulse,bool points);
void setRingParameters(double speedScale,double rateHours);
RingClock ringTraceStatus();
void setAppearance(bool clouds,bool atmosphere,bool trails,bool closeup,bool autoSpin,bool rings);
void setRenderActive(bool active);
RenderStatus renderStatus();
void followSphFragment(int particle,uint64_t revision);
void clearSphFragmentFollow();
void bindSurface(OH_NativeXComponent *component);
void setCamera(float yaw, float pitch, float zoom, int focus, int color);
uint64_t navigateCamera(Camera camera,bool closeup,float duration,bool animatePose,bool force);
CameraMotion cameraMotion(uint64_t requestId=0);
CameraMotion cancelCameraMotion(uint64_t requestId=0);
} // namespace lab
