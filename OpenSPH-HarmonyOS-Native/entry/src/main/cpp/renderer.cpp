#include "renderer.h"
#include "video_output.h"
#include "camera_journey.h"
#include "engine.h"
#include "planet_material.h"
#include "sky_renderer.h"
#include "galaxy_sky_renderer.h"
#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <chrono>
#include <cmath>
#include <hilog/log.h>
#include <mutex>
#include <thread>
namespace lab {
namespace {
class Renderer {
    std::thread thread;
    std::atomic<bool> running{false};
    std::atomic<int> width{1}, height{1};
    std::mutex mutex;
    GalaxyObserverSettings observer;
    Camera camera;
    CameraNavigation navigation;
    FragmentFollower fragmentFollower;
    std::array<float,3> composition{.5f,.5f,1};
    std::shared_ptr<const MoonMap> moonMap;
    Appearance appearance;
    std::array<SurfaceKey,8> surfaceSeeds{};
    MaterialSettings materialSettings;
    RingClock ringClock;uint64_t ringRevision=0;
    SkySettings skySettings;
    std::shared_ptr<const SkyPanorama> skyPanorama;
    RenderStatus stats;
    ProjectedScene projected;
    std::shared_ptr<const Frame> placementFrame;
    double galaxyPlacementRatio=.6;
    int placementParent=0;double placementExtent=0;int placementCandidate=-1;uint64_t placementRevision=0;
    uint64_t projectedRevision=0;
    std::atomic<bool> active{true};
    void error(const std::string &message){std::lock_guard<std::mutex> lock(mutex);stats.error=message;OH_LOG_Print(LOG_APP,LOG_ERROR,0x0200,"SPHLab","render: %{public}s",message.c_str());}
    static GLuint shader(GLenum type, const char *code) {
        GLuint s = glCreateShader(type);
        glShaderSource(s, 1, &code, nullptr);
        glCompileShader(s);
        GLint ok;
        glGetShaderiv(s, GL_COMPILE_STATUS, &ok);
        if (!ok) {
            char log[1024];
            glGetShaderInfoLog(s, sizeof(log), nullptr, log);
            OH_LOG_Print(LOG_APP, LOG_ERROR, 0x0200, "SPHLab", "shader: %{public}s", log);
            glDeleteShader(s);
            return 0;
        }
        return s;
    }
    void render(void *window) {
        EGLDisplay display = eglGetDisplay(EGL_DEFAULT_DISPLAY);
        if (!eglInitialize(display, nullptr, nullptr)){error("EGL initialization failed");return;}
        EGLint attrs[] = {EGL_SURFACE_TYPE,
                          EGL_WINDOW_BIT,
                          EGL_RENDERABLE_TYPE,
                          EGL_OPENGL_ES3_BIT,
                          EGL_RED_SIZE,
                          8,
                          EGL_GREEN_SIZE,
                          8,
                          EGL_BLUE_SIZE,
                          8,
                          EGL_ALPHA_SIZE,
                          8,
                          EGL_DEPTH_SIZE,
                          24,
                          EGL_NONE};
        EGLConfig config;
        EGLint count;
        eglChooseConfig(display, attrs, &config, 1, &count);
        if (!count) {error("EGL configuration unavailable");
            eglTerminate(display);
            return;
        }
        EGLint contextAttrs[] = {EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE};
        EGLContext context = eglCreateContext(display, config, EGL_NO_CONTEXT, contextAttrs);
        EGLSurface surface = eglCreateWindowSurface(display, config, (EGLNativeWindowType)window, nullptr);
        if (context == EGL_NO_CONTEXT || surface == EGL_NO_SURFACE ||
            !eglMakeCurrent(display, surface, surface, context)) {
            error("EGL surface/context unavailable");
            OH_LOG_Print(LOG_APP, LOG_ERROR, 0x0200, "SPHLab", "EGL setup failed: %{public}x", eglGetError());
            if (surface != EGL_NO_SURFACE)
                eglDestroySurface(display, surface);
            if (context != EGL_NO_CONTEXT)
                eglDestroyContext(display, context);
            eglTerminate(display);
            return;
        }
        const char *vs = R"(#version 300 es
precision highp float;
layout(location=0) in vec3 position;
layout(location=1) in vec3 data;
layout(location=2) in vec3 diagnostic;
layout(location=3) in float groupAnchor;
uniform vec3 camera;
uniform vec3 center;
uniform float aspect;
uniform vec3 composition;
uniform float size;
uniform int mode;
uniform int orbital;
uniform highp int galactic;
uniform int surfaces[8];
uniform float meltEnergyMJkg;
out vec3 tint;
out float heat;
void main(){
 heat=0.;
 vec3 p=position-center;
 float a=camera.x,b=camera.y;
 p=vec3(cos(a)*p.x+sin(a)*p.z,p.y,-sin(a)*p.x+cos(a)*p.z);
 p=vec3(p.x,cos(b)*p.y-sin(b)*p.z,sin(b)*p.y+cos(b)*p.z);
 gl_Position=vec4(p.x/(camera.z*aspect),p.y/camera.z,-p.z/100.0,1.0);
 gl_Position.xy=gl_Position.xy*composition.z+vec2(composition.x*2.-1.,1.-composition.y*2.);
 gl_PointSize=orbital==1?size:max(1.0,size*composition.z);
 // Deterministic particle grain: identity survives deformation and replay.
 float grain=fract(sin(float(gl_VertexID+1)*12.9898)*43758.5453);
 tint=(data.z<0.5?vec3(0.60,0.64,0.69):vec3(0.77,0.49,0.32))*(0.72+0.40*grain);
 if(mode==1)tint=mix(vec3(0.18,0.43,0.9),vec3(1.0,0.36,0.12),clamp(data.x/10.0,0.0,1.0));
 if(mode==2)tint=mix(vec3(0.30,0.22,0.70),vec3(0.94,0.86,0.49),clamp(data.y/5000.0,0.0,1.0));
 if(mode==3)tint=diagnostic.x<0.?mix(vec3(.90,.92,.96),vec3(.18,.43,.9),clamp(-diagnostic.x/10.,0.,1.)):mix(vec3(.90,.92,.96),vec3(1.,.30,.16),clamp(diagnostic.x/10.,0.,1.));
 if(mode==4)tint=mix(vec3(.18,.25,.48),vec3(1.,.74,.22),clamp(diagnostic.y/10.,0.,1.));
 if(mode==6){float hue=fract((groupAnchor+1.)*.61803398875);tint=.55+.38*cos(6.2831853*(hue+vec3(0.,.333333,.666667)));}
 if(mode==5)tint=mix(vec3(.30,.74,.76),vec3(.96,.28,.35),clamp(diagnostic.z,0.,1.));
 if(mode==7||mode==8){
   float ratio=diagnostic.y/meltEnergyMJkg;
   float softening=ratio<.00001?0.:clamp(ratio,0.,1.);
   float strength=(1.-diagnostic.z)*(1.-softening);
   if(mode==7){heat=softening;vec3 rock=tint*(1.-.55*diagnostic.z);vec3 hot=mix(vec3(.72,.055,.008),vec3(1.,.85,.38),softening*softening);tint=mix(rock,hot,smoothstep(.02,1.,softening));}
   else tint=mix(vec3(.97,.29,.18),vec3(.35,.78,.92),strength);
 }
 if(orbital==1&&data.z>=0.0){
   float style=float(surfaces[clamp(int(data.z),0,7)]);
   tint=style<0.5?vec3(1.0,0.80,0.40):(style<1.5?vec3(0.35,0.72,1.0):(style<2.5?vec3(0.90,0.65,0.35):vec3(1.0,0.40,0.40)));
   gl_PointSize=data.z<0.5?size*1.8:size;
   if(mode==1)tint=mix(vec3(0.30,0.45,1.0),vec3(1.0,0.4,0.2),clamp(data.x/50.0,0.0,1.0));
 }
 if(galactic==1){tint=mix(vec3(1.0,.64,.30),vec3(.38,.72,1.0),step(.5,data.z))*(.65+.5*grain);if(mode==1)tint=mix(vec3(.22,.46,1.0),vec3(1.0,.37,.16),clamp(data.x/400.,0.,1.));}
 if(data.z<0.0){tint=vec3(0.28,0.40,0.54);gl_PointSize=2.0;}
})";
        const char *fs = R"(#version 300 es
precision mediump float;
in vec3 tint;
in float heat;
out vec4 color;
uniform int trail;
uniform highp int galactic;
uniform float trailOpacity;
void main(){if(trail==1){color=vec4(tint,trailOpacity);return;}vec2 p=gl_PointCoord*2.0-1.0;float d=dot(p,p);if(d>1.0)discard;
 if(galactic==1){color=vec4(tint,exp(-4.0*d)*.7);return;}
 float light=0.42+0.58*max(0.0,dot(normalize(vec3(p,sqrt(1.0-d))),normalize(vec3(-0.4,0.6,1.0))));
 color=vec4(tint*mix(light,1.,heat),(1.0-smoothstep(0.7,1.0,d)));})";
        GLuint vert = shader(GL_VERTEX_SHADER, vs), frag = shader(GL_FRAGMENT_SHADER, fs);
        GLuint program = glCreateProgram();
        glAttachShader(program, vert);
        glAttachShader(program, frag);
        glLinkProgram(program);
        glDeleteShader(vert);
        glDeleteShader(frag);
        GLint linked=0;glGetProgramiv(program,GL_LINK_STATUS,&linked);
        if(!linked){char log[1024]{};glGetProgramInfoLog(program,sizeof(log),nullptr,log);error(log);}
        {std::lock_guard<std::mutex> lock(mutex);stats.ready=linked!=0;}
        PlanetMaterial material;bool materialTried=false,materialReady=false;
        std::shared_ptr<const MoonMap> attemptedMoon;bool moonReady=false;float moonBlend=0;
        SkyRenderer sky;bool skyReady=false;std::string skyError;
        try{skyReady=sky.init(skyError);}catch(const std::exception &e){skyError=e.what();}
        if(!skyReady){sky.release();error(skyError);}else{std::lock_guard<std::mutex> lock(mutex);stats.skyReady=true;}
        GalaxySkyRenderer galaxySky;std::string galaxySkyError;const bool galaxySkyReady=galaxySky.init(galaxySkyError);if(!galaxySkyReady)error(galaxySkyError);
        float skyStars=0,skyGalaxy=0,photoMix=0;bool photoReady=false;
        std::shared_ptr<const SkyPanorama> uploadedPanorama;
        double previewTime=0;ViewportComposition framing;
        auto lastClock=std::chrono::steady_clock::now();
        GLuint vao, vbo;
        glGenVertexArrays(1, &vao);
        glBindVertexArray(vao);
        glGenBuffers(1, &vbo);
        glBindBuffer(GL_ARRAY_BUFFER, vbo);
        glEnableVertexAttribArray(0);
        glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, sizeof(Particle), nullptr);
        glEnableVertexAttribArray(1);
        glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, sizeof(Particle), (void *)(3 * sizeof(float)));
        GLuint diagnosticVbo;glGenBuffers(1,&diagnosticVbo);
        GLuint fragmentVbo;glGenBuffers(1,&fragmentVbo);
        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
        glEnable(GL_DEPTH_TEST);
        SurfaceGenerator generator;
        while (running && linked) {
            auto begin = std::chrono::steady_clock::now();
            double dt=std::min(.1,std::chrono::duration<double>(begin-lastClock).count());lastClock=begin;
            updateVideoOutput(display,config);
            if(!active){std::this_thread::sleep_for(std::chrono::milliseconds(100));continue;}
            std::shared_ptr<const SkyPanorama> panorama;std::shared_ptr<const MoonMap> moon;
            std::array<SurfaceKey,8> seeds;
            Camera c;Appearance a;MaterialSettings m;SkySettings skyConfig;std::array<float,3> compositionTarget;
            {
                std::lock_guard<std::mutex> lock(mutex);
                seeds=surfaceSeeds;moon=moonMap;panorama=skyPanorama;c = camera;a=appearance;m=materialSettings;skyConfig=skySettings;compositionTarget=composition;
            }
            if(skyReady && panorama && panorama!=uploadedPanorama){
                photoReady=sky.uploadPanorama(*panorama,skyError);uploadedPanorama=panorama;
                if(!photoReady)error(skyError);
            }
            photoMix=std::min(1.f,photoMix+(photoReady?float(dt)*2.f:0.f));
            {std::lock_guard<std::mutex> lock(mutex);stats.panoramaReady=photoReady;stats.panoramaBlend=photoMix;}
            int w = width, h = height;
            glViewport(0, 0, w, h);
            glClearColor(0.027f, 0.055f, 0.09f, 1);
            glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
            const auto snapshot=Engine::instance().fragmentFrame();
            const auto revision=snapshot.sceneRevision;
            auto frame=snapshot.frame;
            bool placing=false;int candidate=-1,parent=0;double localExtent=0;
            {std::lock_guard<std::mutex> lock(mutex);
             if(placementFrame&&placementRevision==revision){frame=placementFrame;placing=true;candidate=placementCandidate;parent=placementParent;localExtent=placementExtent;}}

            GalaxyObserverSettings observerSettings;{std::lock_guard<std::mutex> lock(mutex);observerSettings=observer;}
            const auto observerView=galaxyObserverView(snapshot,observerSettings);
            const bool observing=observerView.mode>0&&!placing&&galaxySkyReady;
            int pending=0,generatedCount=0;std::string generatedError;
            for(int i=0;i<8;i++){
                SurfaceKey key{};if(frame&&frame->orbital&&size_t(i)<frame->surfaces.size()){key=seeds[i];key.style=frame->surfaces[i];}
                generator.request(i,key);auto state=generator.state(i);pending+=state.pending;
                if(!state.error.empty())generatedError=state.error;
                if(state.result&&state.result->key==key)++generatedCount;
                if(materialReady)try{material.updateGenerated(i,state.result,float(dt));}catch(const std::exception &e){generatedError=e.what();}
            }
            {std::lock_guard<std::mutex> lock(mutex);stats.surfacePending=pending;stats.surfaceGenerated=generatedCount;stats.surfaceError=generatedError;}
            ProjectedScene shown;shown.width=w;shown.height=h;shown.time=frame?frame->time:0;
            if(frame&&frame->orbital&&!materialTried){materialTried=true;std::string message;
                try {materialReady=material.init(message);}catch(const std::exception &e){message=e.what();}
                if(!materialReady)error(message);else {std::lock_guard<std::mutex> lock(mutex);stats.texturesReady=true;}
                dt=0;lastClock=std::chrono::steady_clock::now();
            }
            if(materialReady&&moon&&moon!=attemptedMoon&&frame&&std::find(frame->surfaces.begin(),frame->surfaces.end(),5)!=frame->surfaces.end()){
                attemptedMoon=moon;std::string message;moonReady=material.uploadMoon(*moon,message);moonBlend=0;
                std::lock_guard<std::mutex> lock(mutex);stats.moonReady=moonReady;stats.moonError=message;if(moonReady)stats.moonUploads++;
            }
            if(moonReady)moonBlend=std::min(1.f,moonBlend+float(dt)*4.f);
            {std::lock_guard<std::mutex> lock(mutex);stats.moonBlend=moonBlend;}
            RingClock trace;
            {std::lock_guard<std::mutex> lock(mutex);
             // A frame sampled before a new CLI scene request must not cancel that new ring.
             if(ringClock.enabled&&ringRevision!=Engine::instance().sceneRevision()){ringClock.enabled=false;ringClock.running=false;}
             const bool matching=frame&&revision==ringRevision;
             if(ringClock.enabled&&matching&&(!frame->orbital||ringClock.target<1||size_t(ringClock.target)>=frame->surfaces.size()||frame->surfaces[ringClock.target]!=4)){ringClock.enabled=false;ringClock.running=false;}
             if(matching)ringClock.advance(dt);trace=ringClock;if(!matching)trace.enabled=false;
            }
            if(materialReady)material.updateRing(trace);
            bool detail=frame&&frame->orbital&&a.closeup&&c.focus>=0&&size_t(c.focus)<frame->particles.size();
            CameraJourney journey;uint64_t cameraRequest=0;
            {std::lock_guard<std::mutex> lock(mutex);
             navigation.step(revision,float(dt));c=navigation.displayed();journey=navigation.journey();cameraRequest=navigation.status().requestId;
            }
            const bool contactDetail=!placing&&frame&&frame->radiiAU.size()==frame->particles.size()&&!frame->radiiAU.empty()&&a.closeup;
            if(contactDetail)c.zoom*=.0001f;
            if(placing&&parent>0)c.zoom*=float(localExtent/2.7);
            float blend=placing||contactDetail?0:journey.totalDetail();
            shown.placement=placing;shown.candidate=candidate;shown.camera=c;
            framing.step(compositionTarget,float(dt));const auto compositionNow=framing.current();
            if(detail&&a.autoSpin)previewTime+=dt;
            const float dim=1-.65f*blend;
            auto approach=[&](float value,float target){return value+std::clamp(target-value,-float(dt)*2.f,float(dt)*2.f);};
            skyStars=approach(skyStars,skyConfig.mode>0?skyConfig.brightness*dim:0);
            skyGalaxy=approach(skyGalaxy,skyConfig.mode==2?skyConfig.brightness*dim:0);
            if(skyReady&&!observing)sky.draw(c.yaw,c.pitch,w,h,skyStars,skyGalaxy,photoMix);
            glUseProgram(program);glBindVertexArray(vao);glBindBuffer(GL_ARRAY_BUFFER,vbo);
            float cx = frame&&frame->orbital?0:0.5f, cy = 0, cz = 0;
            if(frame&&!frame->orbital){
                cx=(frame->galaxy.available?0.f:.5f)*journey.tracking(8);cy=cz=0;
                for(int i=0;i<2;++i){float weight=journey.tracking(i);cx+=frame->centers[i*3]*weight;cy+=frame->centers[i*3+1]*weight;cz+=frame->centers[i*3+2]*weight;}
            }
            if(frame&&frame->orbital){
                cx=cy=cz=0;
                for(size_t i=0;i<frame->particles.size()&&i<8;++i){const auto &p=frame->particles[i];float weight=journey.tracking(int(i));cx+=p.x*weight;cy+=p.y*weight;cz+=p.z*weight;}
            }
            if(placing){if(frame->galaxy.available){cx=cy=cz=0;}else{cx=frame->particles[parent].x;cy=frame->particles[parent].y;cz=frame->particles[parent].z;}}
            shown.composition=compositionNow;
            FragmentFollowStatus followed;
            {std::lock_guard<std::mutex> lock(mutex);
             auto center=fragmentFollower.step(revision,Engine::instance().sceneRevision(),frame?&frame->fragments:nullptr,frame?frame->time:0,{cx,cy,cz},dt);
             cx=center[0];cy=center[1];cz=center[2];followed=fragmentFollower.status();}
            // Keep the same field of view on the shorter axis when a device folds
            // or rotates; portrait windows must not crop the default experiment.
            const float aspect = float(std::max(w, 1)) / std::max(h, 1);
            const float projectionZoom = c.zoom / std::min(aspect, 1.0f);
            glUniform3f(glGetUniformLocation(program, "camera"), c.yaw, c.pitch, projectionZoom);
            glUniform3f(glGetUniformLocation(program, "center"), cx, cy, cz);
            glUniform1f(glGetUniformLocation(program, "aspect"), aspect);
            glUniform3f(glGetUniformLocation(program,"composition"),compositionNow[0],compositionNow[1],compositionNow[2]);
            glUniform1i(glGetUniformLocation(program, "mode"), c.color);
            glUniform1f(glGetUniformLocation(program,"meltEnergyMJkg"),float(ROCK_MELT_ENERGY_JKG/1e6));
            int styles[8]={0,1,2,3,1,1,1,1};if(frame&&frame->orbital)for(size_t i=0;i<frame->surfaces.size();++i)styles[i]=frame->surfaces[i];
            glUniform1iv(glGetUniformLocation(program,"surfaces"),8,styles);
            glUniform1i(glGetUniformLocation(program,"orbital"),frame&&frame->orbital?1:0);
            glUniform1i(glGetUniformLocation(program,"galactic"),frame&&frame->galaxy.available?1:0);
            glUniform1i(glGetUniformLocation(program,"trail"),0);
            glUniform1f(glGetUniformLocation(program,"trailOpacity"),(placing||a.trails)?.65f*(1-blend):0.f);
            glUniform1f(glGetUniformLocation(program, "size"), 2);
            if(observing){galaxySky.draw(*frame,observerView,w,h);}
            if (frame&&!observing) {
                float size = std::clamp(float(h) / projectionZoom / std::cbrt(float(frame->particles.size())) * ((c.color==0||c.color==6||c.color==7)?0.9f:0.32f),
                                        3.0f, (c.color==0||c.color==6||c.color==7)?96.0f:18.0f);
                if(frame->orbital){
                    size=std::clamp(float(std::min(w,h))*0.011f,8.0f,24.0f);
                    glUniform1i(glGetUniformLocation(program,"trail"),1);glDepthMask(GL_FALSE);
                    glBufferData(GL_ARRAY_BUFFER,frame->trails.size()*sizeof(Particle),frame->trails.data(),GL_STREAM_DRAW);
                    int n=frame->trails.size()/frame->particles.size();
                    for(size_t i=0;i<frame->particles.size();++i)glDrawArrays(GL_LINE_STRIP,i*n,n);
                    glDepthMask(GL_TRUE);glUniform1i(glGetUniformLocation(program,"trail"),0);
                }
                if(frame->orbital&&materialReady){
                    auto rotate=[&](float x,float y,float z){return rotateView(c,x,y,z);};
                    shown.ready=true;
                    std::vector<size_t> order;for(size_t i=0;i<frame->particles.size();++i)order.push_back(i);
                    auto drawDepth=[&](size_t i){const auto &p=frame->particles[i];return projectBody(c,int(i),rotate(p.x-cx,p.y-cy,p.z-cz),w,h,blend,placing||contactDetail?0:journey.detail(int(i))).depth;};
                    std::stable_sort(order.begin(),order.end(),[&](size_t i,size_t j){return drawDepth(i)<drawDepth(j);});
                    glDisable(GL_DEPTH_TEST);
                    for(size_t i:order){const auto &p=frame->particles[i];auto v=rotate(p.x-cx,p.y-cy,p.z-cz);
                        size_t source=0;double flux=-1;
                        for(size_t j=0;j<frame->particles.size();j++)if(j!=i&&frame->surfaces[j]==0){const auto& star=frame->particles[j];double d2=(star.x-p.x)*(star.x-p.x)+(star.y-p.y)*(star.y-p.y)+(star.z-p.z)*(star.z-p.z);double f=std::pow(double(star.density),3.5)/std::max(d2,1.e-12);if(f>flux){source=j;flux=f;}}
                        // One dominant stellar light; multi-source atmosphere/scattering is a later model.
                        const auto &star=frame->particles[source];auto light=rotate(star.x-p.x,star.y-p.y,star.z-p.z);
                        float len=std::sqrt(light[0]*light[0]+light[1]*light[1]+light[2]*light[2]);if(len<1.e-6f)light={-.4f,.5f,1.f};else for(auto &x:light)x/=len;
                        auto projectedBody=projectBody(c,int(i),v,w,h,blend,placing||contactDetail?0:journey.detail(int(i)));
                        if(contactDetail)projectedBody.radius=float(frame->radiiAU[i])/(2*projectionZoom);
                        if(placing&&int(i)==candidate){projectedBody.opacity=.82f;projectedBody.radius=std::max(projectedBody.radius*1.4f,float(std::min(w,h))*.025f/h);}
                        // Reserve the ring envelope through the existing continuous detail transition.
                        if(frame->surfaces[i]==4&&!placing&&!contactDetail)projectedBody.radius/=1.f+1.26f*journey.detail(int(i));
                        projectedBody.x=compositionNow[0]+(projectedBody.x-.5f)*compositionNow[2];projectedBody.y=compositionNow[1]+(projectedBody.y-.5f)*compositionNow[2];projectedBody.radius*=compositionNow[2];shown.bodies.push_back(projectedBody);
                        float phase=float(std::fmod(frame->time*.75+previewTime*.012,1.0));
                        SurfaceView view{projectedBody.x*2-1,1-projectedBody.y*2,-projectedBody.depth/100,
                            projectedBody.radius*2,aspect,c.yaw,c.pitch,phase,float(std::fmod(frame->time*.78+previewTime*.014+.07,1.0)),
                            {light[0],light[1],light[2]},frame->surfaces[i],c.color,p.speed,a.clouds,a.atmosphere,a.rings&&!contactDetail,projectedBody.opacity,m.exposure,m.ocean,m.cloudShadows,moonBlend,int(i)};
                        if(view.opacity>.001f){view.activeRing=trace.enabled&&trace.target==int(i);material.draw(view);if(view.activeRing&&trace.points&&view.rings)material.drawRingGrains(view);}
                    }
                    glEnable(GL_DEPTH_TEST);
                } else {
                if(frame->galaxy.available&&placing){
                    shown.ready=true;
                    for(int i=0;i<2;i++){auto v=rotateView(c,frame->centers[i*3],frame->centers[i*3+1],frame->centers[i*3+2]);auto p=projectBody(c,i,v,w,h,0,0);
                        p.x=compositionNow[0]+(p.x-.5f)*compositionNow[2];p.y=compositionNow[1]+(p.y-.5f)*compositionNow[2];shown.bodies.push_back(p);}
                    glUniform1i(glGetUniformLocation(program,"trail"),1);glDepthMask(GL_FALSE);
                    glBufferData(GL_ARRAY_BUFFER,frame->trails.size()*sizeof(Particle),frame->trails.data(),GL_STREAM_DRAW);
                    glDrawArrays(GL_LINES,0,frame->trails.size());glUniform1i(glGetUniformLocation(program,"trail"),0);
                }
                if(frame->galaxy.available){size=std::clamp(float(std::min(w,h))*.006f,2.f,7.f);glBlendFunc(GL_SRC_ALPHA,GL_ONE);glDepthMask(GL_FALSE);}
                glUniform1f(glGetUniformLocation(program, "size"), size);
                glBufferData(GL_ARRAY_BUFFER, frame->particles.size() * sizeof(Particle),
                             frame->particles.data(), GL_STREAM_DRAW);
                if(frame->sph.available&&frame->scalars.size()==frame->particles.size()){
                    glBindBuffer(GL_ARRAY_BUFFER,diagnosticVbo);glBufferData(GL_ARRAY_BUFFER,frame->scalars.size()*sizeof(SphScalar),frame->scalars.data(),GL_STREAM_DRAW);
                    glEnableVertexAttribArray(2);glVertexAttribPointer(2,3,GL_FLOAT,GL_FALSE,sizeof(SphScalar),nullptr);
                }else {glDisableVertexAttribArray(2);glVertexAttrib3f(2,0,0,0);if(c.color>=3)glUniform1i(glGetUniformLocation(program,"mode"),0);}
                if(c.color>=7&&!frame->sph.response.available)glUniform1i(glGetUniformLocation(program,"mode"),0);
                if(c.color==6&&frame->fragments.available&&frame->fragments.labels.size()==frame->particles.size()){
                    glBindBuffer(GL_ARRAY_BUFFER,fragmentVbo);glBufferData(GL_ARRAY_BUFFER,frame->fragments.labels.size()*sizeof(uint32_t),frame->fragments.labels.data(),GL_STREAM_DRAW);glEnableVertexAttribArray(3);glVertexAttribPointer(3,1,GL_UNSIGNED_INT,GL_FALSE,sizeof(uint32_t),nullptr);
                }else{glDisableVertexAttribArray(3);glVertexAttrib1f(3,0);if(c.color==6)glUniform1i(glGetUniformLocation(program,"mode"),0);}
                glDrawArrays(GL_POINTS, 0, frame->particles.size());if(frame->galaxy.available){glDepthMask(GL_TRUE);glBlendFunc(GL_SRC_ALPHA,GL_ONE_MINUS_SRC_ALPHA);}glDisableVertexAttribArray(3);
                glDisableVertexAttribArray(2);glBindBuffer(GL_ARRAY_BUFFER,vbo);
                }
            }
            GLenum glError=glGetError();if(glError!=GL_NO_ERROR)error("OpenGL draw error "+std::to_string(glError));
            {std::lock_guard<std::mutex> lock(mutex);stats.galaxyObserverMode=observing?observerView.mode:0;stats.galaxyObserverTime=observing?observerView.time:0;stats.sceneRevision=revision;stats.fragmentFollow=followed;stats.cameraMoving=navigation.moving()||framing.moving()||followed.moving;stats.compositionX=compositionNow[0];stats.compositionY=compositionNow[1];stats.compositionScale=compositionNow[2];stats.centerX=cx;stats.centerY=cy;stats.centerZ=cz;stats.frames++;stats.skyStars=skyStars;stats.skyGalaxy=skyGalaxy;stats.previewSeconds=previewTime;stats.submitMs=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-begin).count();}
            if(!submitVideoOutput(display,context,surface,w,h,!observing&&skyConfig.mode==2&&photoReady&&photoMix>0)){error("Unable to restore scene after video frame");break;}
            if (!eglSwapBuffers(display, surface)){error("EGL swap failed");break;}
            {std::lock_guard<std::mutex> lock(mutex);stats.materialExposure=m.exposure;stats.materialOcean=m.ocean;stats.materialCloudShadows=m.cloudShadows;navigation.presented(cameraRequest);projected=std::move(shown);projectedRevision=revision;}
            std::this_thread::sleep_until(begin + std::chrono::milliseconds(33));
        }
        releaseVideoOutput(display);
        galaxySky.release();
        sky.release();
        material.release();
        glDeleteBuffers(1, &fragmentVbo);
        glDeleteBuffers(1, &diagnosticVbo);
        glDeleteBuffers(1, &vbo);
        glDeleteVertexArrays(1, &vao);
        glDeleteProgram(program);
        eglMakeCurrent(display, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
        eglDestroySurface(display, surface);
        eglDestroyContext(display, context);
        eglTerminate(display);
        {std::lock_guard<std::mutex> lock(mutex);stats.ready=false;stats.moonReady=false;stats.moonBlend=0;stats.texturesReady=false;stats.skyReady=false;stats.panoramaReady=false;stats.panoramaBlend=0;}
    }

  public:
    ~Renderer() { stop(); }
    void start(void *window, int w, int h) {
        stop();
        {std::lock_guard<std::mutex> lock(mutex);int starts=stats.surfaceStarts+1;stats=RenderStatus{};stats.surfaceStarts=starts;projected=ProjectedScene{};}
        width = w;
        height = h;
        running = true;
        thread = std::thread(&Renderer::render, this, window);
    }
    void resize(int w, int h) {
        width = std::max(w, 1);
        height = std::max(h, 1);
    }
    void stop() {
        running = false;
        if (thread.joinable())
            thread.join();
    }
    void observerSet(int mode,double yaw,double pitch,double fov,double latitude,double siderealHours){
        validateGalaxyObserver(mode,yaw,pitch,fov,latitude,siderealHours);auto snapshot=Engine::instance().fragmentFrame();
        GalaxyObserverSettings next{mode,yaw,pitch,fov,snapshot.sceneRevision,latitude,siderealHours};
        if(mode&&!galaxyObserverView(snapshot,next).available)throw std::runtime_error("需要含初始帧的星系实验记录");
        std::lock_guard<std::mutex> lock(mutex);if(mode&&placementFrame&&placementRevision==snapshot.sceneRevision)throw std::runtime_error("请先退出放置预览");observer=next;projected.ready=false;
    }
    GalaxyObserverView observerStatus(){auto snapshot=Engine::instance().fragmentFrame();GalaxyObserverSettings settings;{std::lock_guard<std::mutex> lock(mutex);settings=observer;}return galaxyObserverView(snapshot,settings);}
    void galaxyPlacement(bool enabled,const GalaxyParameters& parameters){
        std::shared_ptr<Frame> f;
        if(enabled){GalaxySystem system(parameters);f=std::make_shared<Frame>();f->galaxy=system.diagnostics();
            for(int i=0;i<2;i++)for(int k=0;k<3;k++)f->centers[i*3+k]=system.cores[i].position[k]/GALAXY_VIEW_KPC;
            for(const auto& p:system.points)f->particles.push_back({float(p.position[0]/GALAXY_VIEW_KPC),float(p.position[1]/GALAXY_VIEW_KPC),float(p.position[2]/GALAXY_VIEW_KPC),float(galaxyLength(p.velocity)*GALAXY_SPEED_KMS),0,float(p.origin)});
            const float x=float(6/(1+parameters.massRatio)),y=float(parameters.offset/10/(1+parameters.massRatio));
            // Allowed offset rail and incoming relative-velocity arrow. These are guides, not an integrated orbit.
            auto point=[](float x,float y){return Particle{x,y,0,0,0,1};};
            f->trails={point(x,0),point(x,float(3/(1+parameters.massRatio))),point(x,y),point(x-1,y),point(x-1,y),point(x-.8f,y+.12f),point(x-1,y),point(x-.8f,y-.12f)};
        }
        std::lock_guard<std::mutex> lock(mutex);placementFrame=std::move(f);placementCandidate=enabled?1:-1;placementRevision=Engine::instance().sceneRevision();galaxyPlacementRatio=parameters.massRatio;projected.ready=false;
    }
    double galaxyPlacementPoint(double x,double y){
        std::lock_guard<std::mutex> lock(mutex);
        if(!placementFrame||!placementFrame->galaxy.available||!projected.placement||!projected.ready||!active||!running||projectedRevision!=Engine::instance().sceneRevision()||placementRevision!=projectedRevision||projected.width!=width||projected.height!=height)
            throw std::runtime_error("星系预览尚未就绪，请稍后重试");
        return galaxyOffsetAt(projected.camera,projected.width,projected.height,projected.composition,x,y,galaxyPlacementRatio);
    }
    void placement(const std::vector<OrbitSpec>& bodies,int candidate,int parent,double extent) {
        std::shared_ptr<Frame> preview;
        if(!bodies.empty()){
            preview=std::make_shared<Frame>();preview->orbital=true;
            for(size_t i=0;i<bodies.size();++i){const auto& b=bodies[i];
                Particle p{float(b.xAU),float(b.yAU),float(b.zAU),float(std::hypot(b.vxKmS,std::hypot(b.vyKmS,b.vzKmS))),float(b.massSolar),float(i)};
                preview->particles.push_back(p);preview->surfaces.push_back(b.surface);
                // A direction arrow in simulation coordinates, relative to the parent.
                auto tip=p,wing1=p,wing2=p;
                if(int(i)==candidate){auto& star=bodies[parent];double vx=b.vxKmS-star.vxKmS,vy=b.vyKmS-star.vyKmS,vz=b.vzKmS-star.vzKmS;
                    double speed=std::hypot(vx,std::hypot(vy,vz));
                    if(speed>1.e-9){double length=std::clamp(std::hypot(b.xAU-star.xAU,std::hypot(b.yAU-star.yAU,b.zAU-star.zAU))*.25,parent>0?.0000001:.08,1.);
                        vx*=length/speed;vy*=length/speed;vz*=length/speed;
                        tip.x+=vx;tip.y+=vy;tip.z+=vz;
                        wing1=wing2=tip;wing1.x-=vx*.25-vy*.14;wing1.y-=vy*.25+vx*.14;wing1.z-=vz*.25;
                        wing2.x-=vx*.25+vy*.14;wing2.y-=vy*.25-vx*.14;wing2.z-=vz*.25;
                    }
                }
                for(auto q:{p,tip,wing1,tip,wing2})preview->trails.push_back(q);
            }
        }
        std::lock_guard<std::mutex> lock(mutex);placementFrame=std::move(preview);placementCandidate=candidate;placementParent=parent;placementExtent=extent;placementRevision=Engine::instance().sceneRevision();
        if(!placementFrame)projected.ready=false;
    }
    std::array<double,2> placementPoint(double x,double y,double tilt){
        std::lock_guard<std::mutex> lock(mutex);
        if(!placementFrame||!projected.placement||!projected.ready||!active||!running||
           projectedRevision!=Engine::instance().sceneRevision()||placementRevision!=projectedRevision||projected.width!=width||projected.height!=height)
            throw std::runtime_error("放置星图尚未就绪，请稍后重试");
        return placementOnPlane(projected.camera,projected.width,projected.height,projected.composition,x,y,tilt,placementParent>0);
    }
    void configureTrace(bool on,bool play,int target,double mass){std::lock_guard<std::mutex> lock(mutex);ringClock.configure(on,play,target,mass);ringRevision=Engine::instance().sceneRevision();}
    void traceDisturbance(double kick,bool grains){std::lock_guard<std::mutex> lock(mutex);ringClock.disturbance(kick,grains);}
    void traceParameters(double scale,double rate){std::lock_guard<std::mutex> lock(mutex);ringClock.parameters(scale,rate);}
    void seekTrace(double t){std::lock_guard<std::mutex> lock(mutex);ringClock.seek(t);}
    RingClock traceStatus(){std::lock_guard<std::mutex> lock(mutex);return ringClock;}
    void setComposition(float x,float y,float scale){std::lock_guard<std::mutex> lock(mutex);composition={x,y,scale};}
    void setPanorama(std::shared_ptr<const SkyPanorama> p){std::lock_guard<std::mutex> lock(mutex);skyPanorama=std::move(p);}
    void setMaterial(MaterialSettings m){if(!std::isfinite(m.exposure)||m.exposure<-2||m.exposure>2)throw std::invalid_argument("Exposure must be -2..2 EV");std::lock_guard<std::mutex> lock(mutex);materialSettings=m;}
    void setMoon(std::shared_ptr<const MoonMap> map){std::lock_guard<std::mutex> lock(mutex);moonMap=std::move(map);}
    void setSky(SkySettings s){std::lock_guard<std::mutex> lock(mutex);skySettings=s;}
    void setSeeds(const std::array<SurfaceKey,8> &keys){std::lock_guard<std::mutex> lock(mutex);surfaceSeeds=keys;}
    void setAppearance(Appearance a){std::lock_guard<std::mutex> lock(mutex);appearance=a;}
    void setActive(bool value){active=value;}
    RenderStatus status(){std::lock_guard<std::mutex> lock(mutex);auto s=stats;s.active=active;if(s.fragmentFollow.sceneRevision!=Engine::instance().sceneRevision())s.fragmentFollow={};return s;}
    ProjectedScene projection(){std::lock_guard<std::mutex> lock(mutex);
        auto p=projected;if(!running||!active||!stats.ready||projectedRevision!=Engine::instance().sceneRevision()||p.width!=width||p.height!=height){p.ready=false;p.bodies.clear();}return p;
    }
    void followFragment(int particle,uint64_t revision){
        const auto snapshot=Engine::instance().fragmentFrame();
        if(snapshot.sceneRevision!=revision||!snapshot.frame||!snapshot.frame->fragments.available||particle<0||size_t(particle)>=snapshot.frame->fragments.labels.size())throw std::invalid_argument("Material selection expired or unavailable");
        std::lock_guard<std::mutex> lock(mutex);
        if(Engine::instance().sceneRevision()!=revision)throw std::invalid_argument("Material scene changed");
        fragmentFollower.select(particle,revision);
    }
    void clearFragment(){std::lock_guard<std::mutex> lock(mutex);fragmentFollower.clear();}
    void set(Camera c) {
        std::lock_guard<std::mutex> lock(mutex);
        navigation.request(Engine::instance().sceneRevision(),c,appearance.closeup,.42f,false,false);
        if(c.focus!=camera.focus)fragmentFollower.clear();
        camera = c;
    }
    uint64_t navigate(Camera c,bool close,float duration,bool animatePose,bool force){
        std::lock_guard<std::mutex> lock(mutex);
        auto id=navigation.request(Engine::instance().sceneRevision(),c,close,duration,animatePose,force);
        if(c.focus!=camera.focus||close)fragmentFollower.clear();
        camera=c;appearance.closeup=close;return id;
    }
    CameraMotion motion(uint64_t id){std::lock_guard<std::mutex> lock(mutex);return navigation.status(id);}
    CameraMotion cancelMotion(uint64_t id){std::lock_guard<std::mutex> lock(mutex);return navigation.cancel(id);}
};
Renderer &renderer() {
    static Renderer r;
    return r;
}
void created(OH_NativeXComponent *c, void *window) {
    uint64_t w = 1, h = 1;
    OH_NativeXComponent_GetXComponentSize(c, window, &w, &h);
    renderer().start(window, w, h);
}
void changed(OH_NativeXComponent *c, void *window) {
    uint64_t w = 1, h = 1;
    OH_NativeXComponent_GetXComponentSize(c, window, &w, &h);
    renderer().resize(w, h);
}
void destroyed(OH_NativeXComponent *, void *) {
    renderer().stop();
    Engine::instance().pause(true);
}
OH_NativeXComponent_Callback callbacks = {created, changed, destroyed, nullptr};
} // namespace
void followSphFragment(int particle,uint64_t revision){renderer().followFragment(particle,revision);}
void clearSphFragmentFollow(){renderer().clearFragment();}
void configureRingTrace(bool on,bool play,int target,double mass){renderer().configureTrace(on,play,target,mass);}
void setRingDisturbance(double kick,bool grains){renderer().traceDisturbance(kick,grains);}
void setRingParameters(double scale,double rate){renderer().traceParameters(scale,rate);}
void seekRingTrace(double t){renderer().seekTrace(t);}
RingClock ringTraceStatus(){return renderer().traceStatus();}
void setAppearance(bool clouds,bool atmosphere,bool trails,bool closeup,bool autoSpin,bool rings){renderer().setAppearance({clouds,atmosphere,trails,closeup,autoSpin,rings});}
void setComposition(float x,float y,float scale){renderer().setComposition(x,y,scale);}
void setSkyPanorama(std::shared_ptr<const SkyPanorama> p){renderer().setPanorama(std::move(p));}
void setMoonMap(std::shared_ptr<const MoonMap> map){renderer().setMoon(std::move(map));}
void setSurfaceSeeds(const std::array<SurfaceKey,8> &keys){renderer().setSeeds(keys);}
void setMaterial(float exposure,bool ocean,bool cloudShadows){renderer().setMaterial({exposure,ocean,cloudShadows});}
void setSky(int mode,float brightness){renderer().setSky({mode,brightness});}
void setRenderActive(bool active){renderer().setActive(active);}
RenderStatus renderStatus(){return renderer().status();}
uint64_t navigateCamera(Camera c,bool close,float duration,bool animatePose,bool force){return renderer().navigate(c,close,duration,animatePose,force);}
CameraMotion cameraMotion(uint64_t id){return renderer().motion(id);}
CameraMotion cancelCameraMotion(uint64_t id){return renderer().cancelMotion(id);}
void setGalaxyObserver(int mode,double yaw,double pitch,double fov,double latitude,double siderealHours){renderer().observerSet(mode,yaw,pitch,fov,latitude,siderealHours);}
GalaxyObserverView galaxyObserverStatus(){return renderer().observerStatus();}
void setGalaxyPlacement(bool enabled,const GalaxyParameters& parameters){renderer().galaxyPlacement(enabled,parameters);}
double placeGalaxyAt(double x,double y){return renderer().galaxyPlacementPoint(x,y);}
void setOrbitPlacement(const std::vector<OrbitSpec>& bodies,int candidate,int parent,double extent){renderer().placement(bodies,candidate,parent,extent);}
std::array<double,2> placeOrbitAt(double x,double y,double tilt){return renderer().placementPoint(x,y,tilt);}
ProjectedScene projectedScene(){return renderer().projection();}
void bindSurface(OH_NativeXComponent *c) { OH_NativeXComponent_RegisterCallback(c, &callbacks); }
void setCamera(float yaw, float pitch, float zoom, int focus, int color) {
    if (!std::isfinite(yaw) || !std::isfinite(pitch) || !std::isfinite(zoom))
        return;
    renderer().set({yaw, std::clamp(pitch, -1.5f, 1.5f), std::clamp(zoom, 0.5f, 15.0f), focus, color});
}
} // namespace lab
