#pragma once
#include <GLES3/gl3.h>
#include <string>
namespace lab {
struct SurfaceView {
 float x,y,z,radius,aspect; // screen center NDC, depth and radius in vertical NDC units
 float yaw,pitch,phase,cloudPhase;
 float light[3];int style,color;float speed;
 bool clouds,atmosphere,rings;float opacity;
};
class PlanetMaterial {
 GLuint program=0,vao=0,vbo=0,surfaces[5]{},cloudMaps[5]{};
public:
 bool init(std::string &error);
 void draw(const SurfaceView &view);
 void release(); // call on owning render thread before its EGL context is destroyed
};
}
