#include "planet_material.h"
#include "planet_texture.h"
#include "projection.h"
namespace lab {
namespace {
const char *vertex=R"(#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
uniform vec3 origin;
uniform float radius,aspect;
uniform int style;
out vec2 local;
void main(){local=corner*(style==4?2.32:1.13);gl_Position=vec4(origin.xy+local*vec2(radius/aspect,radius),origin.z,1.0);}
)";
const char *fragment=R"(#version 300 es
precision highp float;
in vec2 local;
out vec4 outputColor;
uniform sampler2D surfaceMap,cloudMap;
uniform vec3 light;
uniform vec2 orientation;
uniform float phase,cloudPhase,speed,opacity;
uniform int style,colorMode,clouds,atmosphere,rings;
const float PI=3.141592653589793;
vec3 worldNormal(vec3 n){float a=orientation.x,b=orientation.y;n=vec3(n.x,cos(b)*n.y+sin(b)*n.z,-sin(b)*n.y+cos(b)*n.z);return vec3(cos(a)*n.x-sin(a)*n.z,n.y,sin(a)*n.x+cos(a)*n.z);}
// The tilted equator and rings share a fixed world-space axis (27 degrees).
vec3 ringNormal(){float a=orientation.x,b=orientation.y;vec3 w=vec3(.454,.891,0.0);vec3 v=vec3(cos(a)*w.x,w.y,-sin(a)*w.x);return normalize(vec3(v.x,cos(b)*v.y-sin(b)*v.z,sin(b)*v.y+cos(b)*v.z));}
float ringDensity(float r){
 float aa=max(fwidth(r),.002);
 float envelope=smoothstep(1.24-aa,1.24+aa,r)*(1.0-smoothstep(2.26-aa,2.26+aa,r));
 float gap=smoothstep(1.89-aa,1.91+aa,r)*(1.0-smoothstep(1.99-aa,2.01+aa,r));
 // Filter the fine radial bands as their projected footprint becomes subpixel.
 float fine=.5+.5*sin(r*260.0)*exp(-aa*90.0);
 return envelope*(1.0-gap*.94)*(.45+.22*fine+.12*sin(r*23.0));
}
vec3 surfaceNormal(vec3 n){vec3 w=worldNormal(n);return style==4?vec3(.891*w.x-.454*w.y,.454*w.x+.891*w.y,w.z):w;}
float ringShadow(vec3 position){
 if(style!=4||rings==0)return 1.0;
 vec3 axis=ringNormal();float denominator=dot(axis,light);
 if(abs(denominator)<.0001)return 1.0;
 float t=-dot(axis,position)/denominator;
 return t>0.0?1.0-.72*ringDensity(length(position+t*light)):1.0;
}
vec2 uv(vec3 n,float spin){n=normalize(n);return vec2(atan(n.z,n.x)/(2.0*PI)+.5+spin,asin(clamp(n.y,-1.0,1.0))/PI+.5);}
vec4 sampleMap(sampler2D map,vec2 p){vec2 dx=dFdx(p),dy=dFdy(p);dx.x-=round(dx.x);dy.x-=round(dy.x);return textureGrad(map,p,dx,dy);}
vec4 surfaceAt(vec3 n){return sampleMap(surfaceMap,uv(n,phase));}
vec4 sphereColor(){
 float r=length(local),edge=max(fwidth(r),.0006);
 if(r>1.13)return vec4(0);
 vec3 air=style==1?vec3(.12,.42,1.0):(style==2?vec3(.95,.58,.24):vec3(.65,.27,.14));
 if(r>1.0){
  if(atmosphere==0||colorMode!=0)return vec4(0);
  float halo=exp(-(r-1.0)*(style==0?24.0:55.0))*(1.0-smoothstep(1.08,1.13,r));
  float day=max(0.0,dot(normalize(vec3(local,.08)),light));
  if(style==0){return vec4(vec3(1.0,.49,.08),halo*.48);}
  return vec4(air,halo*(.08+.45*day)*(style==3?.28:1.0));
 }
 vec3 n=vec3(local,sqrt(max(0.0,1.0-r*r))),w=surfaceNormal(n);
 vec4 texel=surfaceAt(w);
 float diffuse=max(dot(n,light),0.0);
 vec3 base=texel.rgb;
 if(colorMode==1)base=mix(vec3(.30,.45,1.0),vec3(1.0,.4,.2),clamp(speed/50.0,0.0,1.0));
 if(style==0){return vec4(base*(.73+.27*n.z),1.0);}
 float cover=0.0,shadow=0.0;
 if(clouds==1&&colorMode==0){
   vec3 cn=vec3(local/1.012,sqrt(max(0.0,1.0-dot(local/1.012,local/1.012))));
   cover=sampleMap(cloudMap,uv(surfaceNormal(cn),cloudPhase)).r;
   shadow=sampleMap(cloudMap,uv(normalize(w+surfaceNormal(light)*.016),cloudPhase)).r;
 }
 vec3 lit=base*(.035+diffuse*.95)*(1.0-shadow*.32);
 if(colorMode==0&&style==1){float spec=pow(max(dot(n,normalize(light+vec3(0,0,1))),0.0),90.0)*texel.a*diffuse*(1.0-cover);
  lit+=vec3(.80,.87,1.0)*spec*.85;}
 vec3 cloudTint=style==2?vec3(.92,.80,.56):vec3(.96,.98,1.0);
 lit=mix(lit,cloudTint*(.055+diffuse*.92),cover);
 lit*=ringShadow(n);
 if(atmosphere==1&&colorMode==0)lit+=air*pow(1.0-n.z,3.2)*(.04+.40*diffuse)*(style==3?.25:1.0);
 // Modest gamma correction for the display; no HDR/bloom claim.
 return vec4(pow(max(lit,vec3(0)),vec3(.85)),1.0-smoothstep(1.0-edge,1.0,r));
}
void main(){
 vec4 ball=sphereColor();
 vec4 ring=vec4(0);float z=-1.e6;
 if(style==4&&rings==1){
  vec3 axis=ringNormal();
  // Orthographic view ray vs. tilted equatorial plane. Edge-on has zero area.
  if(abs(axis.z)>.0001){
   z=-dot(axis.xy,local)/axis.z;vec3 point=vec3(local,z);float radial=length(point);
   float density=ringDensity(radial)*smoothstep(.0001,.012,abs(axis.z));
   float facing=abs(dot(axis,light));
   float side=dot(axis,light)*axis.z>=0.0?1.0:.56;
   float toward=dot(point,light),disc=toward*toward-dot(point,point)+1.0;
   float shadow=disc>0.0&&toward<0.0?.16:1.0;
   vec3 tint=mix(vec3(.44,.36,.27),vec3(.86,.77,.60),clamp((radial-1.24)/1.02,0.0,1.0));
   if(colorMode==1)tint=mix(vec3(.30,.45,1.0),vec3(1.0,.4,.2),clamp(speed/50.0,0.0,1.0));
   ring=vec4(tint*(.24+.76*sqrt(facing))*side*shadow,density);
  }
 }
 float sphereZ=sqrt(max(0.0,1.0-dot(local,local)));
 bool inFront=dot(local,local)>1.0||z>sphereZ;
 vec4 top=inFront?ring:ball,bottom=inFront?ball:ring;
 float alpha=top.a+bottom.a*(1.0-top.a);
 if(alpha<.001)discard;
 outputColor=vec4((top.rgb*top.a+bottom.rgb*bottom.a*(1.0-top.a))/alpha,alpha*opacity);
}

)";
const char *traceVertex=R"(#version 300 es
precision highp float;
layout(location=0) in vec4 point;
uniform vec3 origin;uniform float radius,aspect;
out vec3 position;out float band;
void main(){position=point.xyz;band=point.w;gl_Position=vec4(origin.xy+point.xy*vec2(radius/aspect,radius),origin.z,1);gl_PointSize=6.0;}
)";
const char *traceFragment=R"(#version 300 es
precision highp float;
in vec3 position;in float band;uniform float opacity;out vec4 outputColor;
void main(){float r=dot(position.xy,position.xy);if(r<1.0&&position.z<sqrt(1.0-r))discard;
 float d=length(gl_PointCoord*2.0-1.0);if(d>1.0)discard;
 outputColor=vec4(mix(vec3(.25,.88,1),vec3(1,.73,.30),band),(1.0-smoothstep(.45,1.0,d))*opacity);}
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
 GLuint tv=compile(GL_VERTEX_SHADER,traceVertex,error),tf=compile(GL_FRAGMENT_SHADER,traceFragment,error);
 if(!tv||!tf){if(tv)glDeleteShader(tv);if(tf)glDeleteShader(tf);release();return false;}
 traceProgram=glCreateProgram();glAttachShader(traceProgram,tv);glAttachShader(traceProgram,tf);glLinkProgram(traceProgram);glDeleteShader(tv);glDeleteShader(tf);
 glGetProgramiv(traceProgram,GL_LINK_STATUS,&ok);if(!ok){error="Ring tracer shader link failed";release();return false;}
 glGenVertexArrays(1,&traceVao);glBindVertexArray(traceVao);glGenBuffers(1,&traceVbo);glBindBuffer(GL_ARRAY_BUFFER,traceVbo);glEnableVertexAttribArray(0);glVertexAttribPointer(0,4,GL_FLOAT,GL_FALSE,0,nullptr);
 const auto &maps=planetTextures();glGenTextures(5,surfaces);glGenTextures(5,cloudMaps);
 for(int i=0;i<5;++i){upload(surfaces[i],maps[i],false);upload(cloudMaps[i],maps[i],true);}
 GLenum e=glGetError();if(e!=GL_NO_ERROR){error="Planet texture upload GL error "+std::to_string(e);release();return false;}return true;
}
void PlanetMaterial::draw(const SurfaceView &v){
 if(v.style<0||v.style>=5)return;
 glUseProgram(program);glBindVertexArray(vao);
 glUniform3f(glGetUniformLocation(program,"origin"),v.x,v.y,v.z);glUniform1f(glGetUniformLocation(program,"radius"),v.radius);glUniform1f(glGetUniformLocation(program,"aspect"),v.aspect);
 glUniform2f(glGetUniformLocation(program,"orientation"),v.yaw,v.pitch);glUniform3fv(glGetUniformLocation(program,"light"),1,v.light);
 glUniform1f(glGetUniformLocation(program,"opacity"),v.opacity);glUniform1f(glGetUniformLocation(program,"phase"),v.phase);glUniform1f(glGetUniformLocation(program,"cloudPhase"),v.cloudPhase);glUniform1f(glGetUniformLocation(program,"speed"),v.speed);
 glUniform1i(glGetUniformLocation(program,"style"),v.style);glUniform1i(glGetUniformLocation(program,"colorMode"),v.color);
 glUniform1i(glGetUniformLocation(program,"rings"),v.rings);glUniform1i(glGetUniformLocation(program,"clouds"),v.clouds);glUniform1i(glGetUniformLocation(program,"atmosphere"),v.atmosphere);
 glActiveTexture(GL_TEXTURE0);glBindTexture(GL_TEXTURE_2D,surfaces[v.style]);glUniform1i(glGetUniformLocation(program,"surfaceMap"),0);
 glActiveTexture(GL_TEXTURE1);glBindTexture(GL_TEXTURE_2D,cloudMaps[v.style]);glUniform1i(glGetUniformLocation(program,"cloudMap"),1);
 glDrawArrays(GL_TRIANGLES,0,6);glActiveTexture(GL_TEXTURE0);
}
void PlanetMaterial::drawTrace(const SurfaceView &v,const std::vector<RingPoint> &points){
 std::vector<float> data;data.reserve(points.size()*4);Camera c;c.yaw=v.yaw;c.pitch=v.pitch;
 const double length=std::hypot(.891,.454);
 for(const auto &p:points){auto q=rotateView(c,float(p.x/RING_RADIUS_KM*.891/length),float(-p.x/RING_RADIUS_KM*.454/length),float(p.y/RING_RADIUS_KM));
  data.insert(data.end(),{q[0],q[1],q[2],float((p.radiusKm/RING_RADIUS_KM-RING_INNER)/(RING_OUTER-RING_INNER))});}
 glUseProgram(traceProgram);glBindVertexArray(traceVao);glBindBuffer(GL_ARRAY_BUFFER,traceVbo);glBufferData(GL_ARRAY_BUFFER,data.size()*sizeof(float),data.data(),GL_STREAM_DRAW);
 glUniform3f(glGetUniformLocation(traceProgram,"origin"),v.x,v.y,v.z);glUniform1f(glGetUniformLocation(traceProgram,"radius"),v.radius);glUniform1f(glGetUniformLocation(traceProgram,"aspect"),v.aspect);glUniform1f(glGetUniformLocation(traceProgram,"opacity"),v.opacity);
 glDrawArrays(GL_POINTS,0,GLsizei(points.size()));
}
void PlanetMaterial::release(){if(traceVbo)glDeleteBuffers(1,&traceVbo);if(traceVao)glDeleteVertexArrays(1,&traceVao);if(traceProgram)glDeleteProgram(traceProgram);traceVbo=traceVao=traceProgram=0;if(vbo)glDeleteBuffers(1,&vbo);if(vao)glDeleteVertexArrays(1,&vao);if(program)glDeleteProgram(program);glDeleteTextures(5,surfaces);glDeleteTextures(5,cloudMaps);vbo=vao=program=0;for(auto &v:surfaces)v=0;for(auto &v:cloudMaps)v=0;}
}
