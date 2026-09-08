#pragma once
#include <EGL/egl.h>
#include <cstdint>
#include <string>
namespace lab {
struct VideoOutputStatus { bool attached=false,pending=false; uint64_t frames=0; int width=0,height=0; std::string error; };
void requestVideoOutput(uint64_t id,int width,int height);
VideoOutputStatus videoOutputStatus();
void updateVideoOutput(EGLDisplay display,EGLConfig config);
bool submitVideoOutput(EGLDisplay display,EGLContext context,EGLSurface screen,int width,int height,bool photo);
void releaseVideoOutput(EGLDisplay display);
}
