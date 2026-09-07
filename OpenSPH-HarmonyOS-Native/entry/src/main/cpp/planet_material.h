#pragma once
#include <GLES3/gl3.h>
#include <string>
#include "ring_trace.h"
#include "moon_map.h"
namespace lab {
struct SurfaceView {
 float x,y,z,radius,aspect; // screen center NDC, depth and radius in vertical NDC units
 float yaw,pitch,phase,cloudPhase;
 float light[3];int style,color;float speed;
 bool clouds,atmosphere,rings;float opacity;
 float exposure;bool ocean,cloudShadows;float moonBlend;
};
class PlanetMaterial {
 GLuint traceProgram=0,traceVao=0,traceVbo=0;
 GLuint moonTexture=0;
 GLuint program=0,vao=0,vbo=0,surfaces[5]{},cloudMaps[5]{};
public:
 bool init(std::string &error);
 bool uploadMoon(const MoonMap &map,std::string &error);
 void draw(const SurfaceView &view);
 void drawTrace(const SurfaceView &view,const std::vector<RingPoint> &points);
 void release(); // call on owning render thread before its EGL context is destroyed
};
}
