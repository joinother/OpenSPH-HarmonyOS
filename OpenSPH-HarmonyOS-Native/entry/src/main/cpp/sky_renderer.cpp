#include "sky_renderer.h"
#include "sky_data.h"
#include <algorithm>
namespace lab {
namespace {
const char *quadVS=R"(#version 300 es
precision highp float;
out vec2 screen;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);screen=p*2.0-1.0;gl_Position=vec4(screen,0.0,1.0);}
)";
const char *skyFS=R"(#version 300 es
precision highp float;
in vec2 screen;out vec4 color;
uniform vec2 orientation,scale;uniform float strength,photoMix;uniform sampler2D haze,panorama;
void main(){vec3 n=normalize(vec3(screen*scale,-1.0));float a=orientation.x,b=orientation.y;
 n=vec3(n.x,cos(b)*n.y+sin(b)*n.z,-sin(b)*n.y+cos(b)*n.z);
 n=vec3(cos(a)*n.x-sin(a)*n.z,n.y,sin(a)*n.x+cos(a)*n.z);
 vec2 uv=vec2(atan(n.z,n.x)/6.28318530718+.5,asin(clamp(n.y,-1.0,1.0))/3.14159265359+.5);
 vec2 dx=dFdx(uv),dy=dFdy(uv);dx.x-=round(dx.x);dy.x-=round(dy.x);
 vec3 synthetic=textureGrad(haze,uv,dx,dy).rgb;
 // The photographic panorama is galactic-plane centred. This basis places it
 // in the simulation sky; it is deliberately not an astrometric ICRS transform.
 vec3 pole=normalize(vec3(-.5,.85,-.17));
 vec3 centre=normalize(vec3(.286,-.095,-.953)-pole*dot(vec3(.286,-.095,-.953),pole));
 vec3 tangent=normalize(cross(pole,centre));
 vec2 photoUv=vec2(atan(dot(n,tangent),dot(n,centre))/6.28318530718+.5,
                  .5-asin(clamp(dot(n,pole),-1.0,1.0))/3.14159265359);
 vec2 px=dFdx(photoUv),py=dFdy(photoUv);px.x-=round(px.x);py.x-=round(py.x);
 vec3 photo=textureGrad(panorama,photoUv,px,py).rgb;
 // LDR photographic exposure, not physical luminance; keep dust dark and
 // avoid lifting the whole black sky when the user's brightness is increased.
 photo=pow(max(photo-vec3(.012),vec3(0.0)),vec3(1.12))*.82;
 color=vec4(vec3(.003,.004,.007)+mix(synthetic,photo,photoMix)*strength,1.0);}
)";
const char *starVS=R"(#version 300 es
precision highp float;
layout(location=0) in vec3 direction;layout(location=1) in float luminosity;layout(location=2) in vec3 tint;
uniform vec2 orientation,scale;uniform float strength,pixelScale;out vec4 light;
void main(){float a=orientation.x,b=orientation.y;vec3 p=direction;
 p=vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);
 p=vec3(p.x,cos(b)*p.y-sin(b)*p.z,sin(b)*p.y+cos(b)*p.z);
 gl_Position=vec4(p.xy/scale,0.0,-p.z);gl_PointSize=(1.2+3.5*luminosity)*pixelScale;
 light=vec4(tint,(.25+.75*luminosity)*strength);}
)";
const char *starFS=R"(#version 300 es
precision mediump float;
in vec4 light;out vec4 color;
void main(){float r=length(gl_PointCoord*2.0-1.0);if(r>1.0)discard;
 float glow=exp(-r*r*4.0)*(1.0-smoothstep(.75,1.0,r));color=vec4(light.rgb,light.a*glow);}
)";
GLuint program(const char *vs,const char *fs,std::string &error){GLuint shaders[2]{};const char* code[2]={vs,fs};
 for(int i=0;i<2;i++){shaders[i]=glCreateShader(i?GL_FRAGMENT_SHADER:GL_VERTEX_SHADER);glShaderSource(shaders[i],1,&code[i],nullptr);glCompileShader(shaders[i]);GLint ok=0;glGetShaderiv(shaders[i],GL_COMPILE_STATUS,&ok);if(!ok){char log[2048]{};glGetShaderInfoLog(shaders[i],sizeof(log),nullptr,log);error=log;for(auto s:shaders)if(s)glDeleteShader(s);return 0;}}
 GLuint p=glCreateProgram();for(auto s:shaders)glAttachShader(p,s);glLinkProgram(p);for(auto s:shaders)glDeleteShader(s);GLint ok=0;glGetProgramiv(p,GL_LINK_STATUS,&ok);if(!ok){char log[2048]{};glGetProgramInfoLog(p,sizeof(log),nullptr,log);error=log;glDeleteProgram(p);return 0;}return p;
}
}
bool SkyRenderer::init(std::string &error){
 skyProgram=program(quadVS,skyFS,error);if(!skyProgram)return false;starProgram=program(starVS,starFS,error);if(!starProgram){release();return false;}
 auto data=makeSkyData();starCount=int(data.stars.size());
 glGenVertexArrays(1,&quadVao);glGenTextures(1,&texture);glBindTexture(GL_TEXTURE_2D,texture);
 glTexImage2D(GL_TEXTURE_2D,0,GL_RGB8,data.width,data.height,0,GL_RGB,GL_UNSIGNED_BYTE,data.haze.data());
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_REPEAT);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);glGenerateMipmap(GL_TEXTURE_2D);
 glGenVertexArrays(1,&starVao);glBindVertexArray(starVao);glGenBuffers(1,&starBuffer);glBindBuffer(GL_ARRAY_BUFFER,starBuffer);
 glBufferData(GL_ARRAY_BUFFER,data.stars.size()*sizeof(SkyStar),data.stars.data(),GL_STATIC_DRAW);
 for(int i=0;i<3;i++)glEnableVertexAttribArray(i);
 glVertexAttribPointer(0,3,GL_FLOAT,GL_FALSE,sizeof(SkyStar),nullptr);glVertexAttribPointer(1,1,GL_FLOAT,GL_FALSE,sizeof(SkyStar),(void*)(3*sizeof(float)));glVertexAttribPointer(2,3,GL_FLOAT,GL_FALSE,sizeof(SkyStar),(void*)(4*sizeof(float)));
 auto e=glGetError();if(e!=GL_NO_ERROR){error="Sky GPU initialization failed: "+std::to_string(e);release();return false;}return true;
}
bool SkyRenderer::uploadPanorama(const SkyPanorama &data,std::string &error){
 GLint limit=0;glGetIntegerv(GL_MAX_TEXTURE_SIZE,&limit);
 if(data.width>limit || data.height>limit){error="Panorama exceeds GPU texture limit";return false;}
 GLuint next=0;glGenTextures(1,&next);glBindTexture(GL_TEXTURE_2D,next);
 glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,data.width,data.height,0,GL_RGBA,GL_UNSIGNED_BYTE,data.rgba.data());
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_REPEAT);
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);glGenerateMipmap(GL_TEXTURE_2D);
 auto status=glGetError();if(status!=GL_NO_ERROR){glDeleteTextures(1,&next);error="Panorama upload failed: "+std::to_string(status);return false;}
 if(panoramaTexture)glDeleteTextures(1,&panoramaTexture);panoramaTexture=next;return true;
}
void SkyRenderer::draw(float yaw,float pitch,int w,int h,float stars,float galaxy,float photoMix){
 if(!skyProgram||!starProgram)return;float aspect=float(std::max(1,w))/std::max(1,h),v=.75f/std::min(aspect,1.f);
 glDisable(GL_DEPTH_TEST);glDepthMask(GL_FALSE);glDisable(GL_BLEND);
 glUseProgram(skyProgram);glBindVertexArray(quadVao);glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,texture);
 glActiveTexture(GL_TEXTURE1);glBindTexture(GL_TEXTURE_2D,panoramaTexture?panoramaTexture:texture);
 glUniform1i(glGetUniformLocation(skyProgram,"panorama"),1);
 glUniform1f(glGetUniformLocation(skyProgram,"photoMix"),photoMix);
 glUniform1i(glGetUniformLocation(skyProgram,"haze"),0);glUniform2f(glGetUniformLocation(skyProgram,"orientation"),yaw,pitch);glUniform2f(glGetUniformLocation(skyProgram,"scale"),v*aspect,v);glUniform1f(glGetUniformLocation(skyProgram,"strength"),galaxy);glDrawArrays(GL_TRIANGLES,0,3);
 glEnable(GL_BLEND);glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA);
 stars=std::max(0.f,stars-galaxy*photoMix);
 if(stars>.001f){glUseProgram(starProgram);glBindVertexArray(starVao);glUniform2f(glGetUniformLocation(starProgram,"orientation"),yaw,pitch);glUniform2f(glGetUniformLocation(starProgram,"scale"),v*aspect,v);glUniform1f(glGetUniformLocation(starProgram,"strength"),stars);glUniform1f(glGetUniformLocation(starProgram,"pixelScale"),std::clamp(float(std::min(w,h))/1000.f,.8f,2.f));glDrawArrays(GL_POINTS,0,starCount);}
 glDepthMask(GL_TRUE);glEnable(GL_DEPTH_TEST);
}
void SkyRenderer::release(){if(panoramaTexture)glDeleteTextures(1,&panoramaTexture);panoramaTexture=0;if(texture)glDeleteTextures(1,&texture);if(starBuffer)glDeleteBuffers(1,&starBuffer);if(starVao)glDeleteVertexArrays(1,&starVao);if(quadVao)glDeleteVertexArrays(1,&quadVao);if(skyProgram)glDeleteProgram(skyProgram);if(starProgram)glDeleteProgram(starProgram);texture=starBuffer=starVao=quadVao=skyProgram=starProgram=0;starCount=0;}
}
