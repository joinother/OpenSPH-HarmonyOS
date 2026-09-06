#include "planet_material.h"
#include "planet_texture.h"
namespace lab {
namespace {
const char *vertex=R"(#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
uniform vec3 origin;
uniform float radius,aspect;
out vec2 local;
void main(){local=corner*1.13;gl_Position=vec4(origin.xy+local*vec2(radius/aspect,radius),origin.z,1.0);}
)";
const char *fragment=R"(#version 300 es
precision highp float;
in vec2 local;
out vec4 outputColor;
uniform sampler2D surfaceMap,cloudMap;
uniform vec3 light;
uniform vec2 orientation;
uniform float phase,cloudPhase,speed,opacity;
uniform int style,colorMode,clouds,atmosphere;
const float PI=3.141592653589793;
vec3 worldNormal(vec3 n){float a=orientation.x,b=orientation.y;n=vec3(n.x,cos(b)*n.y+sin(b)*n.z,-sin(b)*n.y+cos(b)*n.z);return vec3(cos(a)*n.x-sin(a)*n.z,n.y,sin(a)*n.x+cos(a)*n.z);}
vec2 uv(vec3 n,float spin){n=normalize(n);return vec2(atan(n.z,n.x)/(2.0*PI)+.5+spin,asin(clamp(n.y,-1.0,1.0))/PI+.5);}
vec4 sampleMap(sampler2D map,vec2 p){vec2 dx=dFdx(p),dy=dFdy(p);dx.x-=round(dx.x);dy.x-=round(dy.x);return textureGrad(map,p,dx,dy);}
vec4 surfaceAt(vec3 n){return sampleMap(surfaceMap,uv(n,phase));}
void main(){
 float r=length(local),edge=max(fwidth(r),.0006);
 if(r>1.13)discard;
 vec3 air=style==1?vec3(.12,.42,1.0):(style==2?vec3(.95,.58,.24):vec3(.65,.27,.14));
 if(r>1.0){
  if(atmosphere==0||colorMode!=0)discard;
  float halo=exp(-(r-1.0)*(style==0?24.0:55.0))*(1.0-smoothstep(1.08,1.13,r));
  float day=max(0.0,dot(normalize(vec3(local,.08)),light));
  if(style==0){outputColor=vec4(vec3(1.0,.49,.08),halo*.48*opacity);return;}
  outputColor=vec4(air,halo*(.08+.45*day)*(style==3?.28:1.0)*opacity);return;
 }
 vec3 n=vec3(local,sqrt(max(0.0,1.0-r*r))),w=worldNormal(n);
 vec4 texel=surfaceAt(w);
 float diffuse=max(dot(n,light),0.0);
 vec3 base=texel.rgb;
 if(colorMode==1)base=mix(vec3(.30,.45,1.0),vec3(1.0,.4,.2),clamp(speed/50.0,0.0,1.0));
 if(style==0){outputColor=vec4(base*(.73+.27*n.z),opacity);return;}
 float cover=0.0,shadow=0.0;
 if(clouds==1&&colorMode==0){
   vec3 cn=vec3(local/1.012,sqrt(max(0.0,1.0-dot(local/1.012,local/1.012))));
   cover=sampleMap(cloudMap,uv(worldNormal(cn),cloudPhase)).r;
   shadow=sampleMap(cloudMap,uv(normalize(w+worldNormal(light)*.016),cloudPhase)).r;
 }
 vec3 lit=base*(.035+diffuse*.95)*(1.0-shadow*.32);
 if(colorMode==0&&style==1){float spec=pow(max(dot(n,normalize(light+vec3(0,0,1))),0.0),90.0)*texel.a*diffuse*(1.0-cover);
  lit+=vec3(.80,.87,1.0)*spec*.85;}
 vec3 cloudTint=style==2?vec3(.92,.80,.56):vec3(.96,.98,1.0);
 lit=mix(lit,cloudTint*(.055+diffuse*.92),cover);
 if(atmosphere==1&&colorMode==0)lit+=air*pow(1.0-n.z,3.2)*(.04+.40*diffuse)*(style==3?.25:1.0);
 // Modest gamma correction for the display; no HDR/bloom claim.
 outputColor=vec4(pow(max(lit,vec3(0)),vec3(.85)),(1.0-smoothstep(1.0-edge,1.0,r))*opacity);
}
)";
GLuint compile(GLenum type,const char *source,std::string &error){GLuint shader=glCreateShader(type);glShaderSource(shader,1,&source,nullptr);glCompileShader(shader);GLint ok=0;glGetShaderiv(shader,GL_COMPILE_STATUS,&ok);if(!ok){char log[2048]{};glGetShaderInfoLog(shader,sizeof(log),nullptr,log);error=log;glDeleteShader(shader);return 0;}return shader;}
void upload(GLuint id,const PlanetTexture &t,bool cloud){glBindTexture(GL_TEXTURE_2D,id);glTexImage2D(GL_TEXTURE_2D,0,cloud?GL_R8:GL_RGBA8,t.width,t.height,0,cloud?GL_RED:GL_RGBA,GL_UNSIGNED_BYTE,cloud?t.clouds.data():t.surface.data());glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_REPEAT);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);glGenerateMipmap(GL_TEXTURE_2D);}
}
bool PlanetMaterial::init(std::string &error){
 GLuint vs=compile(GL_VERTEX_SHADER,vertex,error),fs=compile(GL_FRAGMENT_SHADER,fragment,error);
 if(!vs||!fs){if(vs)glDeleteShader(vs);if(fs)glDeleteShader(fs);return false;}
 program=glCreateProgram();glAttachShader(program,vs);glAttachShader(program,fs);glLinkProgram(program);glDeleteShader(vs);glDeleteShader(fs);
 GLint ok=0;glGetProgramiv(program,GL_LINK_STATUS,&ok);if(!ok){char log[2048]{};glGetProgramInfoLog(program,sizeof(log),nullptr,log);error=log;release();return false;}
 glGenVertexArrays(1,&vao);glBindVertexArray(vao);glGenBuffers(1,&vbo);glBindBuffer(GL_ARRAY_BUFFER,vbo);
 const float quad[]={-1,-1,1,-1,-1,1,-1,1,1,-1,1,1};glBufferData(GL_ARRAY_BUFFER,sizeof(quad),quad,GL_STATIC_DRAW);glEnableVertexAttribArray(0);glVertexAttribPointer(0,2,GL_FLOAT,GL_FALSE,0,nullptr);
 const auto &maps=planetTextures();glGenTextures(4,surfaces);glGenTextures(4,cloudMaps);
 for(int i=0;i<4;++i){upload(surfaces[i],maps[i],false);upload(cloudMaps[i],maps[i],true);}
 GLenum e=glGetError();if(e!=GL_NO_ERROR){error="Planet texture upload GL error "+std::to_string(e);release();return false;}return true;
}
void PlanetMaterial::draw(const SurfaceView &v){
 glUseProgram(program);glBindVertexArray(vao);
 glUniform3f(glGetUniformLocation(program,"origin"),v.x,v.y,v.z);glUniform1f(glGetUniformLocation(program,"radius"),v.radius);glUniform1f(glGetUniformLocation(program,"aspect"),v.aspect);
 glUniform2f(glGetUniformLocation(program,"orientation"),v.yaw,v.pitch);glUniform3fv(glGetUniformLocation(program,"light"),1,v.light);
 glUniform1f(glGetUniformLocation(program,"opacity"),v.opacity);glUniform1f(glGetUniformLocation(program,"phase"),v.phase);glUniform1f(glGetUniformLocation(program,"cloudPhase"),v.cloudPhase);glUniform1f(glGetUniformLocation(program,"speed"),v.speed);
 glUniform1i(glGetUniformLocation(program,"style"),v.style);glUniform1i(glGetUniformLocation(program,"colorMode"),v.color);
 glUniform1i(glGetUniformLocation(program,"clouds"),v.clouds);glUniform1i(glGetUniformLocation(program,"atmosphere"),v.atmosphere);
 glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,surfaces[v.style]);glUniform1i(glGetUniformLocation(program,"surfaceMap"),0);
 glActiveTexture(GL_TEXTURE1);glBindTexture(GL_TEXTURE_2D,cloudMaps[v.style]);glUniform1i(glGetUniformLocation(program,"cloudMap"),1);
 glDrawArrays(GL_TRIANGLES,0,6);glActiveTexture(GL_TEXTURE0);
}
void PlanetMaterial::release(){if(vbo)glDeleteBuffers(1,&vbo);if(vao)glDeleteVertexArrays(1,&vao);if(program)glDeleteProgram(program);glDeleteTextures(4,surfaces);glDeleteTextures(4,cloudMaps);vbo=vao=program=0;for(auto &v:surfaces)v=0;for(auto &v:cloudMaps)v=0;}
}
