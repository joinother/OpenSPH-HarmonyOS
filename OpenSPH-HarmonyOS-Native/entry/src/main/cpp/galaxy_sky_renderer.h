#pragma once
#include "galaxy_observer.h"
#include <GLES3/gl3.h>
namespace lab {
class GalaxySkyRenderer {
    GLuint background=0,points=0,vao=0,vbo=0;
public:
    bool init(std::string& error);
    void draw(const Frame& frame,const GalaxyObserverView& view,int width,int height);
    void release();
};
}
