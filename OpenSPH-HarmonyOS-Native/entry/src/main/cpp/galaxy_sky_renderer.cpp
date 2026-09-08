#include "galaxy_sky_renderer.h"
namespace lab {
namespace {
GLuint compile(GLenum type,const char* text,std::string& error){GLuint s=glCreateShader(type);glShaderSource(s,1,&text,nullptr);glCompileShader(s);GLint ok=0;glGetShaderiv(s,GL_COMPILE_STATUS,&ok);if(!ok){char log[1024]{};glGetShaderInfoLog(s,sizeof(log),nullptr,log);error=log;glDeleteShader(s);return 0;}return s;}
GLuint program(const char* vs,const char* fs,std::string& error){GLuint v=compile(GL_VERTEX_SHADER,vs,error),f=compile(GL_FRAGMENT_SHADER,fs,error);if(!v||!f){if(v)glDeleteShader(v);if(f)glDeleteShader(f);return 0;}GLuint p=glCreateProgram();glAttachShader(p,v);glAttachShader(p,f);glLinkProgram(p);glDeleteShader(v);glDeleteShader(f);GLint ok=0;glGetProgramiv(p,GL_LINK_STATUS,&ok);if(!ok){char log[1024]{};glGetProgramInfoLog(p,sizeof(log),nullptr,log);error=log;glDeleteProgram(p);return 0;}return p;}
const char* common=R"(#version 300 es
precision highp float;
uniform vec3 rightV,upV,forwardV,horizonUp;
uniform vec2 extent,viewport;
uniform int ground;
out vec4 color;
vec3 ray(){vec2 q=gl_FragCoord.xy/viewport*2.-1.;return normalize(forwardV+q.x*extent.x*rightV+q.y*extent.y*upV);}
)";
}
bool GalaxySkyRenderer::init(std::string& error){
    const char* vs=R"(#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);})";
    std::string fs=std::string(common)+R"(
void main(){float altitude=dot(ray(),horizonUp);
 vec3 sky=vec3(.003,.006,.014);
 if(ground==1){if(altitude<0.)sky=mix(vec3(.012,.018,.025),vec3(.04,.05,.065),exp(altitude*28.));else sky+=vec3(.012,.026,.04)*exp(-altitude*18.);}
 color=vec4(sky,1.);})";
    background=program(vs,fs.c_str(),error);
    const char* pv=R"(#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 data;
uniform vec3 observer,rightV,upV,forwardV;
uniform vec2 extent,viewport;
uniform float count;
uniform int anchor,layer;
out vec3 tint;
out vec2 sprite;
void main(){vec3 delta=position-observer;float distance=length(delta);vec3 n=delta/max(distance,.00001);float depth=dot(n,forwardV);
 vec2 q=vec2(dot(n,rightV),dot(n,upV))/extent;
 sprite=vec2(float(gl_VertexID&1),float((gl_VertexID>>1)&1))*2.-1.;
 gl_Position=vec4(q,0.,depth);

 float grain=fract(sin(float(gl_InstanceID+1)*12.9898)*43758.5453);
 tint=mix(vec3(.90,.77,.57),vec3(.48,.66,.94),step(.5,data.z));
 // Equal-weight smoothed tracers; no photometry or artificial inverse-square luminosity.
 float diameter=layer==0?clamp(viewport.y/extent.y*.16/max(depth,.2),6.,320.):clamp(viewport.y*.0012,1.5,3.5);
 gl_Position.xy+=sprite*diameter/viewport*depth;
 if(depth<=.001||gl_InstanceID==anchor||distance<.00001)gl_Position=vec4(2.,2.,2.,1.);
 tint*=layer==0?min(1.,800./count)*.015:(.25+.45*grain);
})";
    fs=std::string(common)+R"(
in vec3 tint;
in vec2 sprite;
void main(){if(ground==1&&dot(ray(),horizonUp)<0.)discard;float d=dot(sprite,sprite);if(d>1.)discard;color=vec4(tint*exp(-4.*d),1.);})";
    points=program(pv,fs.c_str(),error);if(!background||!points){release();return false;}
    glGenVertexArrays(1,&vao);glGenBuffers(1,&vbo);return true;
}
void GalaxySkyRenderer::draw(const Frame& frame,const GalaxyObserverView& view,int width,int height){
    if(!background||!points)return;
    const auto basis=view.mode==2?galaxyGroundBasis(view.settings.yaw,view.settings.pitch,view.settings.latitude,view.settings.siderealHours):galaxySkyBasis(view.settings.yaw,view.settings.pitch);const auto extent=galaxySkyExtent(view.settings.fov,width,height);
    auto vector=[](GLuint p,const char* name,const GalaxyVector& v){glUniform3f(glGetUniformLocation(p,name),v[0],v[1],v[2]);};
    auto uniforms=[&](GLuint p){glUseProgram(p);vector(p,"rightV",basis.right);vector(p,"upV",basis.up);vector(p,"forwardV",basis.forward);vector(p,"horizonUp",galaxyHorizonUp(view.settings.latitude,view.settings.siderealHours));glUniform2f(glGetUniformLocation(p,"extent"),extent[0],extent[1]);glUniform2f(glGetUniformLocation(p,"viewport"),width,height);glUniform1i(glGetUniformLocation(p,"ground"),view.mode==2?1:0);};
    glBindVertexArray(vao);glDisable(GL_DEPTH_TEST);glDepthMask(GL_FALSE);glDisable(GL_BLEND);
    uniforms(background);glDrawArrays(GL_TRIANGLES,0,3);
    uniforms(points);GalaxyVector p=view.positionKpc;for(auto& x:p)x/=GALAXY_VIEW_KPC;vector(points,"observer",p);
    glUniform1i(glGetUniformLocation(points,"anchor"),view.anchor);glUniform1f(glGetUniformLocation(points,"count"),frame.particles.size());
    glBindBuffer(GL_ARRAY_BUFFER,vbo);glBufferData(GL_ARRAY_BUFFER,frame.particles.size()*sizeof(Particle),frame.particles.data(),GL_STREAM_DRAW);
    glEnableVertexAttribArray(0);glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,sizeof(Particle),nullptr);glVertexAttribDivisor(0,1);
    glEnableVertexAttribArray(1);glVertexAttribPointer(1,3,GL_FLOAT,GL_FALSE,sizeof(Particle),(void*)(3*sizeof(float)));glVertexAttribDivisor(1,1);
    glEnable(GL_BLEND);glBlendFunc(GL_ONE_MINUS_DST_COLOR,GL_ONE);
    for(int layer=0;layer<2;layer++){glUniform1i(glGetUniformLocation(points,"layer"),layer);glDrawArraysInstanced(GL_TRIANGLE_STRIP,0,4,frame.particles.size());}
    glDepthMask(GL_TRUE);glEnable(GL_DEPTH_TEST);glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA);
}
void GalaxySkyRenderer::release(){if(background)glDeleteProgram(background);if(points)glDeleteProgram(points);if(vbo)glDeleteBuffers(1,&vbo);if(vao)glDeleteVertexArrays(1,&vao);background=points=vao=vbo=0;}
}
