#pragma once
#include <GLES3/gl3.h>
#include <string>
#include "sky_panorama.h"
namespace lab {
class SkyRenderer {
 GLuint skyProgram=0,starProgram=0,quadVao=0,starVao=0,starBuffer=0,texture=0,panoramaTexture=0;
 int starCount=0;
public:
 bool init(std::string &error);
 bool uploadPanorama(const SkyPanorama &data,std::string &error);
 void draw(float yaw,float pitch,int width,int height,float stars,float galaxy,float photoMix);
 void release();
};
}
