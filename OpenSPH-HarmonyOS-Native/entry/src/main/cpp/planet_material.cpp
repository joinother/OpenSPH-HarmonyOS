#include "planet_material.h"
#include <stdexcept>
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
uniform sampler2D surfaceMap,cloudMap,previousSurfaceMap,previousCloudMap;
uniform float generationBlend;
uniform vec3 light;
uniform vec2 orientation;
uniform float phase,cloudPhase,speed,opacity,exposure,moonBlend;
uniform int style,colorMode,clouds,atmosphere,rings,ocean,cloudShadows;
// Surface RGB is authored display color; masks remain linear data.
vec3 linearColor(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 displayColor(vec3 c){
 c=vec3(1)-exp(-max(c,vec3(0))*exp2(exposure));
 return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-.055,step(vec3(.0031308),c));
}
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
vec4 surfaceAt(vec3 n){vec2 p=uv(n,phase);
 // NASA map is north-first and east-positive; our front-facing basis reverses longitude.
 if(style==5){p=vec2(1.0)-p;return mix(vec4(.45,.45,.45,0),vec4(sampleMap(surfaceMap,p).rgb,0),moonBlend);}
 return mix(sampleMap(previousSurfaceMap,p),sampleMap(surfaceMap,p),generationBlend);}

vec4 sphereColor(){
 float r=length(local),edge=max(fwidth(r),.0006);
 if(r>1.13)return vec4(0);
 vec3 air=style==1?vec3(.12,.42,1.0):(style==2?vec3(.95,.58,.24):vec3(.65,.27,.14));
 if(r>1.0){
  if(style==5||atmosphere==0||colorMode!=0)return vec4(0);
  float halo=exp(-(r-1.0)*(style==0?24.0:55.0))*(1.0-smoothstep(1.08,1.13,r));
  float day=max(0.0,dot(normalize(vec3(local,.08)),light));
  if(style==0){return vec4(displayColor(linearColor(vec3(1.0,.49,.08))*2.0),halo*.48);}
  return vec4(displayColor(linearColor(air)),halo*(.08+.45*day)*(style==3?.28:1.0));
 }
 vec3 n=vec3(local,sqrt(max(0.0,1.0-r*r))),w=surfaceNormal(n);
 vec4 texel=surfaceAt(w);
 float diffuse=max(dot(n,light),0.0);
 vec3 base=colorMode==0?linearColor(texel.rgb):texel.rgb;
 if(colorMode==1)base=mix(vec3(.30,.45,1.0),vec3(1.0,.4,.2),clamp(speed/50.0,0.0,1.0));
 if(style==0){vec3 emission=base*(.73+.27*n.z);return vec4(colorMode==0?displayColor(emission*2.0):emission,1.0);}
 float cover=0.0,shadow=0.0;
 if(style!=5&&clouds==1&&colorMode==0){
   vec3 cn=vec3(local/1.012,sqrt(max(0.0,1.0-dot(local/1.012,local/1.012))));
   cover=mix(sampleMap(previousCloudMap,uv(surfaceNormal(cn),cloudPhase)).r,sampleMap(cloudMap,uv(surfaceNormal(cn),cloudPhase)).r,generationBlend);
   if(cloudShadows==1)shadow=mix(sampleMap(previousCloudMap,uv(normalize(w+surfaceNormal(light)*.016),cloudPhase)).r,sampleMap(cloudMap,uv(normalize(w+surfaceNormal(light)*.016),cloudPhase)).r,generationBlend);
 }
 vec3 lit=base*(.035+diffuse*.95)*(1.0-shadow*.32);
 if(colorMode==0&&style==1&&ocean==1){float spec=pow(max(dot(n,normalize(light+vec3(0,0,1))),0.0),90.0)*texel.a*diffuse*(1.0-cover);
  lit+=vec3(.80,.87,1.0)*spec*.85;}
 vec3 cloudTint=style==2?vec3(.92,.80,.56):vec3(.96,.98,1.0);
 lit=mix(lit,linearColor(cloudTint)*(.055+diffuse*.92),cover);
 lit*=ringShadow(n);
 if(style!=5&&atmosphere==1&&colorMode==0)lit+=linearColor(air)*pow(1.0-n.z,3.2)*(.04+.40*diffuse)*(style==3?.25:1.0);
 // Tone-map only original-color planetary layers; diagnostic colors keep their mapping.
 return vec4(colorMode==0?displayColor(lit):pow(max(lit,vec3(0)),vec3(.85)),1.0-smoothstep(1.0-edge,1.0,r));
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
   vec3 ringLit=(colorMode==0?linearColor(tint):tint)*(.24+.76*sqrt(facing))*side*shadow;
   ring=vec4(colorMode==0?displayColor(ringLit):ringLit,density);
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
void PlanetMaterial::updateGenerated(int index,std::shared_ptr<const GeneratedSurface> data,float dt){
 auto &s=generated.at(index);s.blend=std::min(1.f,s.blend+dt/.35f);
 if(s.blend>=1){if(s.previousSurface)glDeleteTextures(1,&s.previousSurface);if(s.previousCloud)glDeleteTextures(1,&s.previousCloud);s.previousSurface=s.previousCloud=0;}
 if(data==s.data)return;
 if(!data){for(auto id:{s.surface,s.cloud,s.previousSurface,s.previousCloud})if(id)glDeleteTextures(1,&id);s=Slot{};return;}
 GLuint maps[2];glGenTextures(2,maps);upload(maps[0],data->texture,false);upload(maps[1],data->texture,true);
 if(glGetError()!=GL_NO_ERROR){glDeleteTextures(2,maps);throw std::runtime_error("Generated surface upload failed");}
 if(s.previousSurface)glDeleteTextures(1,&s.previousSurface);if(s.previousCloud)glDeleteTextures(1,&s.previousCloud);
 s.previousSurface=s.surface;s.previousCloud=s.cloud;s.surface=maps[0];s.cloud=maps[1];s.data=std::move(data);s.blend=0;
}
void PlanetMaterial::draw(const SurfaceView &v){
 if(v.style<0||v.style>5)return;
 glUseProgram(program);glBindVertexArray(vao);
 glUniform1f(glGetUniformLocation(program,"moonBlend"),moonTexture?v.moonBlend:0);
 glUniform3f(glGetUniformLocation(program,"origin"),v.x,v.y,v.z);glUniform1f(glGetUniformLocation(program,"radius"),v.radius);glUniform1f(glGetUniformLocation(program,"aspect"),v.aspect);
 glUniform2f(glGetUniformLocation(program,"orientation"),v.yaw,v.pitch);glUniform3fv(glGetUniformLocation(program,"light"),1,v.light);
 glUniform1f(glGetUniformLocation(program,"opacity"),v.opacity);glUniform1f(glGetUniformLocation(program,"phase"),v.phase);glUniform1f(glGetUniformLocation(program,"cloudPhase"),v.cloudPhase);glUniform1f(glGetUniformLocation(program,"speed"),v.speed);
 glUniform1i(glGetUniformLocation(program,"style"),v.style);glUniform1i(glGetUniformLocation(program,"colorMode"),v.color);
 glUniform1f(glGetUniformLocation(program,"exposure"),v.exposure);glUniform1i(glGetUniformLocation(program,"ocean"),v.ocean);glUniform1i(glGetUniformLocation(program,"cloudShadows"),v.cloudShadows);
 glUniform1i(glGetUniformLocation(program,"rings"),v.rings);glUniform1i(glGetUniformLocation(program,"clouds"),v.clouds);glUniform1i(glGetUniformLocation(program,"atmosphere"),v.atmosphere);
 GLuint baseSurface=v.style==5?(moonTexture?moonTexture:surfaces[3]):surfaces[v.style],baseCloud=cloudMaps[v.style==5?3:v.style];
 Slot *slot=v.bodyIndex>=0&&v.bodyIndex<8?&generated[v.bodyIndex]:nullptr;
 bool custom=slot&&slot->data&&slot->data->key.style==v.style;
 GLuint maps[4]={custom?slot->surface:baseSurface,custom?slot->cloud:baseCloud,custom&&slot->previousSurface?slot->previousSurface:baseSurface,custom&&slot->previousCloud?slot->previousCloud:baseCloud};
 const char *names[4]={"surfaceMap","cloudMap","previousSurfaceMap","previousCloudMap"};
 for(int k=0;k<4;k++){glActiveTexture(GL_TEXTURE0+k);glBindTexture(GL_TEXTURE_2D,maps[k]);glUniform1i(glGetUniformLocation(program,names[k]),k);}
 glUniform1f(glGetUniformLocation(program,"generationBlend"),custom?slot->blend:1.f);
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
bool PlanetMaterial::uploadMoon(const MoonMap &map,std::string &error){
 GLuint next=0;glGenTextures(1,&next);glBindTexture(GL_TEXTURE_2D,next);
 glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,2048,1024,0,GL_RGBA,GL_UNSIGNED_BYTE,map.rgba.data());
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_LINEAR_MIPMAP_LINEAR);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_LINEAR);
 glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_S,GL_REPEAT);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_WRAP_T,GL_CLAMP_TO_EDGE);glGenerateMipmap(GL_TEXTURE_2D);
 GLenum status=glGetError();if(status!=GL_NO_ERROR){glDeleteTextures(1,&next);error="Moon upload GL error "+std::to_string(status);return false;}
 if(moonTexture)glDeleteTextures(1,&moonTexture);moonTexture=next;return true;
}
void PlanetMaterial::release(){for(int i=0;i<8;i++)updateGenerated(i,nullptr,0);if(moonTexture)glDeleteTextures(1,&moonTexture);moonTexture=0;if(traceVbo)glDeleteBuffers(1,&traceVbo);if(traceVao)glDeleteVertexArrays(1,&traceVao);if(traceProgram)glDeleteProgram(traceProgram);traceVbo=traceVao=traceProgram=0;if(vbo)glDeleteBuffers(1,&vbo);if(vao)glDeleteVertexArrays(1,&vao);if(program)glDeleteProgram(program);glDeleteTextures(5,surfaces);glDeleteTextures(5,cloudMaps);vbo=vao=program=0;for(auto &v:surfaces)v=0;for(auto &v:cloudMaps)v=0;}
}
