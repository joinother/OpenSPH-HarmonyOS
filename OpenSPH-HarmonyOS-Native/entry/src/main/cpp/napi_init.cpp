#include "engine.h"
#include "renderer.h"
#include "video_output.h"
#include "dense_ring.h"
#include "impact_plan.h"
#include "impact_tides.h"
#include <cmath>
#include <napi/native_api.h>
#include <stdexcept>
#include <string>
#include <vector>
namespace {
napi_value undef(napi_env env) {
    napi_value v;
    napi_get_undefined(env, &v);
    return v;
}
std::vector<napi_value> args(napi_env env, napi_callback_info info, size_t size) {
    std::vector<napi_value> v(size);
    size_t n = size;
    napi_get_cb_info(env, info, &n, v.data(), nullptr, nullptr);
    if (n != size)
        throw std::invalid_argument("Missing arguments");
    return v;
}
std::vector<napi_value> optionalArgs(napi_env e,napi_callback_info i,size_t size,size_t minimum) {
    std::vector<napi_value> values(size);for(auto& v:values)napi_get_undefined(e,&v);
    size_t count=size;napi_get_cb_info(e,i,&count,values.data(),nullptr,nullptr);
    if(count<minimum)throw std::invalid_argument("Missing arguments");return values;
}
double number(napi_env e, napi_value v) {
    double d;
    if (napi_get_value_double(e, v, &d) != napi_ok)
        throw std::invalid_argument("Number expected");
    if (!std::isfinite(d) || std::abs(d) > 1.e9)
        throw std::invalid_argument("Finite bounded number expected");
    return d;
}
int integer(napi_env e, napi_value v) {
    double d = number(e, v);
    if (std::trunc(d) != d)
        throw std::invalid_argument("Integer expected");
    return static_cast<int>(d);
}
void str(napi_env e, napi_value o, const char *key, const std::string &s) {
    napi_value v;
    napi_create_string_utf8(e, s.c_str(), s.size(), &v);
    napi_set_named_property(e, o, key, v);
}
void num(napi_env e, napi_value o, const char *key, double d) {
    napi_value v;
    napi_create_double(e, d, &v);
    napi_set_named_property(e, o, key, v);
}
napi_value fail(napi_env e, const std::exception &ex) {
    napi_throw_error(e, nullptr, ex.what());
    return undef(e);
}
lab::OrbitSpec orbitSpec(napi_env e,napi_value b) {
    napi_value name;napi_get_named_property(e,b,"name",&name);size_t len=0;
    if(napi_get_value_string_utf8(e,name,nullptr,0,&len)!=napi_ok||len==0||len>192)throw std::invalid_argument("Invalid body name");
    std::string text(len+1,'\0');napi_get_value_string_utf8(e,name,&text[0],len+1,&len);text.resize(len);
    auto f=[&](const char* key){napi_value v;napi_get_named_property(e,b,key,&v);return number(e,v);};
    const double style=f("surface");if(std::trunc(style)!=style)throw std::invalid_argument("Integer surface expected");
    lab::OrbitSpec result{text,f("massSolar"),f("xAU"),f("yAU"),f("zAU"),f("vxKmS"),f("vyKmS"),f("vzKmS"),int(style)};
    bool radius=false;napi_has_named_property(e,b,"radiusKm",&radius);if(radius)result.radiusKm=f("radiusKm");return result;
}
napi_value orbitValue(napi_env e,const lab::OrbitSpec& b) {
    napi_value v;napi_create_object(e,&v);str(e,v,"name",b.name);num(e,v,"massSolar",b.massSolar);num(e,v,"xAU",b.xAU);num(e,v,"yAU",b.yAU);num(e,v,"zAU",b.zAU);
    num(e,v,"vxKmS",b.vxKmS);num(e,v,"vyKmS",b.vyKmS);num(e,v,"vzKmS",b.vzKmS);num(e,v,"surface",b.surface);if(b.radiusKm>0)num(e,v,"radiusKm",b.radiusKm);return v;
}
napi_value orbitClock(napi_env e,napi_callback_info i) {try{auto a=args(e,i,1);lab::Engine::instance().orbitClock(number(e,a[0]));return undef(e);}catch(const std::exception& ex){return fail(e,ex);}}
napi_value freezeOrbit(napi_env e,napi_callback_info) {try{lab::Engine::instance().freezeOrbit();return undef(e);}catch(const std::exception& ex){return fail(e,ex);}}
napi_value insertOrbit(napi_env e,napi_callback_info i) {try{auto a=optionalArgs(e,i,4,3);bool physical=false; napi_valuetype type;napi_typeof(e,a[3],&type);if(type!=napi_undefined&&napi_get_value_bool(e,a[3],&physical)!=napi_ok)throw std::invalid_argument("Boolean expected");bool run=false;if(napi_get_value_bool(e,a[2],&run)!=napi_ok)throw std::invalid_argument("Boolean expected");const int rev=integer(e,a[1]);if(rev<0)throw std::invalid_argument("Invalid revision");lab::Engine::instance().insertOrbit(orbitSpec(e,a[0]),rev,run,physical);return undef(e);}catch(const std::exception& ex){return fail(e,ex);}}
napi_value videoOutput(napi_env e,napi_callback_info i) {
    try {auto a=args(e,i,3);size_t len=0;
        if(napi_get_value_string_utf8(e,a[0],nullptr,0,&len)!=napi_ok||len<1||len>20)throw std::invalid_argument("Invalid surface ID");
        std::string id(len+1,'\0');napi_get_value_string_utf8(e,a[0],&id[0],len+1,&len);id.resize(len);
        if(id.find_first_not_of("0123456789")!=std::string::npos)throw std::invalid_argument("Invalid surface ID");
        lab::requestVideoOutput(std::stoull(id),integer(e,a[1]),integer(e,a[2]));return undef(e);
    }catch(const std::exception& ex){return fail(e,ex);}
}
napi_value videoStatus(napi_env e,napi_callback_info) {
    auto s=lab::videoOutputStatus();napi_value o,v;napi_create_object(e,&o);
    napi_get_boolean(e,s.attached,&v);napi_set_named_property(e,o,"attached",v);
    napi_get_boolean(e,s.pending,&v);napi_set_named_property(e,o,"pending",v);
    num(e,o,"frames",s.frames);num(e,o,"width",s.width);num(e,o,"height",s.height);str(e,o,"error",s.error);return o;
}
napi_value start(napi_env e, napi_callback_info i) {
    try {
        auto a = args(e, i, 5);
        lab::Config c;
        c.preset = integer(e, a[0]);
        c.count = integer(e, a[1]);
        c.speed = number(e, a[2]);
        c.angle = number(e, a[3]);
        c.duration = number(e, a[4]);
        lab::Engine::instance().start(c);
    } catch (const std::exception &ex) {
        return fail(e, ex);
    }
    return undef(e);
}
napi_value startImpact(napi_env e,napi_callback_info i){try{auto a=optionalArgs(e,i,3,2);bool tides=false;napi_valuetype type;napi_typeof(e,a[2],&type);if(type!=napi_undefined&&napi_get_value_bool(e,a[2],&tides)!=napi_ok)throw std::invalid_argument("Boolean tide option expected");lab::Engine::instance().startImpact(integer(e,a[0]),integer(e,a[1]),600,60,tides);}catch(const std::exception& ex){return fail(e,ex);}return undef(e);}
napi_value returnImpact(napi_env e,napi_callback_info){try{lab::Engine::instance().returnFromImpact();}catch(const std::exception& ex){return fail(e,ex);}return undef(e);}
napi_value startScene(napi_env e, napi_callback_info i) {
    try {
        std::vector<napi_value> a(2);size_t count=2;
        if(napi_get_cb_info(e,i,&count,a.data(),nullptr,nullptr)!=napi_ok||count<1)throw std::invalid_argument("Missing scene config");
        bool initiallyPaused=false;
        if(count==2&&napi_get_value_bool(e,a[1],&initiallyPaused)!=napi_ok)throw std::invalid_argument("Boolean initial pause expected");
        auto field = [&](const char *name) { napi_value v; if (napi_get_named_property(e,a[0],name,&v) != napi_ok) throw std::invalid_argument("Missing scene field"); return number(e,v); };
        auto id = [&](const char *name) { double v = field(name); if (std::trunc(v) != v) throw std::invalid_argument("Integer expected"); return int(v); };
        lab::Config c{id("preset"),id("count"),field("speed"),field("angle"),field("duration"),
          field("targetRadiusKm"),field("impactorRadiusKm"),field("targetDensity"),field("impactorDensity"),field("targetSpin"),id("seed")};
        bool impactPresent=false;napi_has_named_property(e,a[0],"impactLocal",&impactPresent);bool tidesPresent=false;napi_has_named_property(e,a[0],"impactTides",&tidesPresent);if(impactPresent||tidesPresent)throw std::invalid_argument("Impact context requires the captured event entry point");
        bool gravityPresent=false;napi_has_named_property(e,a[0],"selfGravity",&gravityPresent);
        if(gravityPresent){napi_value v;napi_get_named_property(e,a[0],"selfGravity",&v);
            if(napi_get_value_bool(e,v,&c.selfGravity)!=napi_ok)throw std::invalid_argument("Boolean selfGravity expected");}
        for(const char* key:{"initialEnergyMJkg","initialDamage"}){bool present=false;napi_has_named_property(e,a[0],key,&present);if(present){if(std::string(key)=="initialEnergyMJkg")c.initialEnergyMJkg=field(key);else c.initialDamage=field(key);}}
        bool relaxPresent=false;napi_has_named_property(e,a[0],"relaxationSeconds",&relaxPresent);
        if(relaxPresent)c.relaxationSeconds=field("relaxationSeconds");
        for(const char* name:{"galaxyMassRatio","galaxyOffsetKpc"}){bool present=false;napi_has_named_property(e,a[0],name,&present);if(present){if(c.preset!=6)throw std::invalid_argument("Galaxy fields require preset 6");if(std::string(name)=="galaxyMassRatio")c.galaxyMassRatio=field(name);else c.galaxyOffsetKpc=field(name);}}
        bool responsivePresent=false;napi_has_named_property(e,a[0],"galaxyResponsive",&responsivePresent);if(responsivePresent){napi_value v;napi_get_named_property(e,a[0],"galaxyResponsive",&v);if(c.preset!=6||napi_get_value_bool(e,v,&c.galaxyResponsive)!=napi_ok)throw std::invalid_argument("Galaxy response boolean expected");}
        bool retroPresent=false;napi_has_named_property(e,a[0],"galaxyRetrograde",&retroPresent);if(retroPresent){napi_value v;napi_get_named_property(e,a[0],"galaxyRetrograde",&v);if(c.preset!=6||napi_get_value_bool(e,v,&c.galaxyRetrograde)!=napi_ok)throw std::invalid_argument("Galaxy boolean expected");}
        napi_value list;bool has=false;napi_has_named_property(e,a[0],"orbitBodies",&has);
        if(has){napi_get_named_property(e,a[0],"orbitBodies",&list);bool array=false;napi_is_array(e,list,&array);uint32_t n=0;
            if(!array||napi_get_array_length(e,list,&n)!=napi_ok||n>8)throw std::invalid_argument("Invalid orbitBodies array");
            for(uint32_t k=0;k<n;++k){napi_value b,name;napi_get_element(e,list,k,&b);napi_get_named_property(e,b,"name",&name);size_t len=0;
                if(napi_get_value_string_utf8(e,name,nullptr,0,&len)!=napi_ok||len==0||len>192)throw std::invalid_argument("Invalid body name");
                std::string s(len+1,'\0');napi_get_value_string_utf8(e,name,&s[0],len+1,&len);s.resize(len);
                auto f=[&](const char *key){napi_value v;napi_get_named_property(e,b,key,&v);return number(e,v);};
                double style=f("surface");if(std::trunc(style)!=style)throw std::invalid_argument("Integer surface expected");
                c.orbitBodies.push_back({s,f("massSolar"),f("xAU"),f("yAU"),f("zAU"),f("vxKmS"),f("vyKmS"),f("vzKmS"),int(style)});bool hasRadius=false;napi_has_named_property(e,b,"radiusKm",&hasRadius);if(hasRadius){double radius=f("radiusKm");if(radius<=0)throw std::invalid_argument("Positive radius expected");c.orbitBodies.back().radiusKm=radius;}}}
        lab::Engine::instance().start(c,initiallyPaused);
    } catch (const std::exception &ex) { return fail(e,ex); }
    return undef(e);
}
napi_value pause(napi_env e, napi_callback_info i) {
    try {
        auto a = args(e, i, 1);
        bool v;
        if (napi_get_value_bool(e, a[0], &v) != napi_ok)
            throw std::invalid_argument("Boolean expected");
        lab::Engine::instance().pause(v);
    } catch (const std::exception &ex) {
        return fail(e, ex);
    }
    return undef(e);
}
napi_value cancel(napi_env e, napi_callback_info) {
    lab::Engine::instance().cancel();
    return undef(e);
}
napi_value seek(napi_env e, napi_callback_info i) {
    try {
        auto a = args(e, i, 1);
        lab::Engine::instance().seek(integer(e, a[0]));
    } catch (const std::exception &ex) {
        return fail(e, ex);
    }
    return undef(e);
}
napi_value camera(napi_env e, napi_callback_info i) {
    try {
        auto a = args(e, i, 5);
        lab::setCamera(number(e, a[0]), number(e, a[1]), number(e, a[2]), integer(e, a[3]), integer(e, a[4]));
    } catch (const std::exception &ex) {
        return fail(e, ex);
    }
    return undef(e);
}
napi_value motionValue(napi_env e,const lab::CameraMotion &s){
    napi_value o;napi_create_object(e,&o);num(e,o,"requestId",s.requestId);num(e,o,"sceneRevision",s.sceneRevision);
    num(e,o,"targetFocus",s.targetFocus);num(e,o,"progress",s.progress);str(e,o,"state",s.state);str(e,o,"reason",s.reason);
    napi_value close;napi_get_boolean(e,s.targetCloseup,&close);napi_set_named_property(e,o,"targetCloseup",close);
    num(e,o,"yaw",s.displayed.yaw);num(e,o,"pitch",s.displayed.pitch);num(e,o,"zoom",s.displayed.zoom);return o;
}
napi_value navigateCamera(napi_env e,napi_callback_info i){try{
    auto a=args(e,i,9);bool close,animate,force;
    if(napi_get_value_bool(e,a[5],&close)!=napi_ok||napi_get_value_bool(e,a[7],&animate)!=napi_ok||napi_get_value_bool(e,a[8],&force)!=napi_ok)throw std::invalid_argument("Boolean camera flags expected");
    auto id=lab::navigateCamera({float(number(e,a[0])),float(number(e,a[1])),float(number(e,a[2])),integer(e,a[3]),integer(e,a[4])},close,number(e,a[6]),animate,force);
    return motionValue(e,lab::cameraMotion(id));
}catch(const std::exception &ex){return fail(e,ex);}}
napi_value getCameraMotion(napi_env e,napi_callback_info i){try{auto a=args(e,i,1);int id=integer(e,a[0]);if(id<0)throw std::invalid_argument("Invalid camera request ID");return motionValue(e,lab::cameraMotion(id));}catch(const std::exception &ex){return fail(e,ex);}}
napi_value cancelCameraMotion(napi_env e,napi_callback_info i){try{auto a=args(e,i,1);int id=integer(e,a[0]);if(id<0)throw std::invalid_argument("Invalid camera request ID");return motionValue(e,lab::cancelCameraMotion(id));}catch(const std::exception &ex){return fail(e,ex);}}
napi_value moonTexture(napi_env e,napi_callback_info i){try{auto a=args(e,i,3);void *data=nullptr;size_t length=0;
 if(napi_get_arraybuffer_info(e,a[0],&data,&length)!=napi_ok)throw std::invalid_argument("Moon RGBA ArrayBuffer required");
 lab::setMoonMap(std::make_shared<const lab::MoonMap>(integer(e,a[1]),integer(e,a[2]),static_cast<const uint8_t*>(data),length));
 }catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value surfaceSeeds(napi_env e,napi_callback_info i){try{
 auto a=args(e,i,1);bool isArray=false;napi_is_array(e,a[0],&isArray);uint32_t length=0;napi_get_array_length(e,a[0],&length);
 if(!isArray||length!=16)throw std::invalid_argument("Expected eight seed pairs");
 std::array<lab::SurfaceKey,8> keys{};
 for(uint32_t n=0;n<16;n++){napi_value v;napi_get_element(e,a[0],n,&v);int value=integer(e,v);if(value<0||value>1000000)throw std::invalid_argument("Surface seed out of range");if(n%2)keys[n/2].cloudSeed=value;else keys[n/2].seed=value;}
 lab::setSurfaceSeeds(keys);
 }catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value material(napi_env e,napi_callback_info i){
 try{auto a=args(e,i,3);double exposure=number(e,a[0]);bool ocean,shadows;if(exposure<-2||exposure>2||napi_get_value_bool(e,a[1],&ocean)!=napi_ok||napi_get_value_bool(e,a[2],&shadows)!=napi_ok)throw std::invalid_argument("Invalid material settings");lab::setMaterial(exposure,ocean,shadows);}catch(const std::exception &ex){return fail(e,ex);}return undef(e);
}
napi_value appearance(napi_env e,napi_callback_info i){
    try {auto a=args(e,i,6);bool b[6];for(int k=0;k<6;++k)if(napi_get_value_bool(e,a[k],&b[k])!=napi_ok)throw std::invalid_argument("Appearance requires booleans");
        lab::setAppearance(b[0],b[1],b[2],b[3],b[4],b[5]);}catch(const std::exception &ex){return fail(e,ex);}return undef(e);
}
napi_value configureTrace(napi_env e,napi_callback_info i){try{auto a=args(e,i,4);bool on,play;if(napi_get_value_bool(e,a[0],&on)!=napi_ok||napi_get_value_bool(e,a[1],&play)!=napi_ok)throw std::invalid_argument("Boolean expected");lab::configureRingTrace(on,play,integer(e,a[2]),number(e,a[3]));}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value traceDisturbance(napi_env e,napi_callback_info i){try{auto a=args(e,i,2);bool grains;if(napi_get_value_bool(e,a[1],&grains)!=napi_ok)throw std::invalid_argument("Boolean expected");lab::setRingDisturbance(number(e,a[0]),grains);}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value traceParameters(napi_env e,napi_callback_info i){try{auto a=args(e,i,2);lab::setRingParameters(number(e,a[0]),number(e,a[1]));}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value seekTrace(napi_env e,napi_callback_info i){try{auto a=args(e,i,1);lab::seekRingTrace(number(e,a[0]));}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value traceStatus(napi_env e,napi_callback_info i){try{auto a=args(e,i,1);bool include;if(napi_get_value_bool(e,a[0],&include)!=napi_ok)throw std::invalid_argument("Boolean expected");auto s=lab::ringTraceStatus();napi_value o,v;napi_create_object(e,&o);
 napi_get_boolean(e,s.enabled,&v);napi_set_named_property(e,o,"enabled",v);napi_get_boolean(e,s.running,&v);napi_set_named_property(e,o,"running",v);
 num(e,o,"target",s.target);num(e,o,"timeHours",s.seconds/3600);num(e,o,"massSolar",s.massSolar);num(e,o,"radiusKm",lab::RING_RADIUS_KM);num(e,o,"count",lab::DENSE_RING_COUNT);num(e,o,"impulse",s.impulse);napi_get_boolean(e,s.points,&v);napi_set_named_property(e,o,"points",v);num(e,o,"returnedCount",include?lab::RING_COUNT:0);str(e,o,"sampling","first-192-of-8192; coordinates used by density map");
 const double e0=s.speedScale*s.speedScale-1,inner=lab::RING_RADIUS_KM*lab::RING_INNER,outer=lab::RING_RADIUS_KM*lab::RING_OUTER;
 const auto ref=lab::ringPoint(s.massSolar,s.seconds,inner,s.speedScale);
 num(e,o,"speedScale",s.speedScale);num(e,o,"rateHours",s.rateHours);num(e,o,"eccentricity",e0);
 num(e,o,"innerApoapsisKm",inner*(1+e0)/(1-e0));num(e,o,"outerApoapsisKm",outer*(1+e0)/(1-e0));
 num(e,o,"referenceXKm",ref.x);num(e,o,"referenceYKm",ref.y);num(e,o,"referenceRadiusKm",std::hypot(ref.x,ref.y));num(e,o,"referenceSpeedKmS",std::hypot(ref.vx,ref.vy));
 num(e,o,"innerPeriodHours",ref.periodSeconds/3600);num(e,o,"outerPeriodHours",lab::ringPeriod(s.massSolar,outer/(1-e0))/3600);str(e,o,"model","restricted-impulse-ring-v3");
 if(include){napi_value list;napi_create_array(e,&list);int index=0;for(const auto &p:lab::denseRing(s.massSolar,s.seconds,s.speedScale,s.impulse)){if(index>=lab::RING_COUNT)break;napi_value point;napi_create_object(e,&point);num(e,point,"xKm",p.x);num(e,point,"yKm",p.y);num(e,point,"vxKmS",p.vx);num(e,point,"vyKmS",p.vy);num(e,point,"radiusKm",p.radiusKm);num(e,point,"periodHours",p.periodSeconds/3600);napi_set_element(e,list,index++,point);}napi_set_named_property(e,o,"particles",list);}return o;
 }catch(const std::exception &ex){return fail(e,ex);}}
napi_value panorama(napi_env e,napi_callback_info i){
    try{auto a=args(e,i,3);void* data=nullptr;size_t size=0;
        if(napi_get_arraybuffer_info(e,a[0],&data,&size)!=napi_ok)throw std::invalid_argument("Panorama requires ArrayBuffer");
        lab::setSkyPanorama(std::make_shared<const lab::SkyPanorama>(integer(e,a[1]),integer(e,a[2]),static_cast<const uint8_t*>(data),size));
    }catch(const std::exception &ex){return fail(e,ex);}return undef(e);
}
napi_value sky(napi_env e,napi_callback_info i){try{auto a=args(e,i,2);int mode=integer(e,a[0]);double brightness=number(e,a[1]);if(mode<0||mode>2||brightness<0||brightness>1)throw std::invalid_argument("Invalid sky settings");lab::setSky(mode,brightness);}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value composition(napi_env e,napi_callback_info i){try{auto a=args(e,i,3);double x=number(e,a[0]),y=number(e,a[1]),s=number(e,a[2]);if(x<0||x>1||y<0||y>1||s<.05||s>1)throw std::invalid_argument("Invalid viewport composition");lab::setComposition(x,y,s);}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value renderActive(napi_env e,napi_callback_info i){try{auto a=args(e,i,1);bool b;if(napi_get_value_bool(e,a[0],&b)!=napi_ok)throw std::invalid_argument("Boolean expected");lab::setRenderActive(b);}catch(const std::exception &ex){return fail(e,ex);}return undef(e);}
napi_value followFragment(napi_env e,napi_callback_info i){try{auto a=args(e,i,2);int revision=integer(e,a[1]);if(revision<0)throw std::invalid_argument("Invalid scene revision");lab::followSphFragment(integer(e,a[0]),uint64_t(revision));}catch(const std::exception&ex){return fail(e,ex);}return undef(e);}
napi_value clearFragmentFollow(napi_env e,napi_callback_info){lab::clearSphFragmentFollow();return undef(e);}
napi_value renderStatus(napi_env e,napi_callback_info){auto s=lab::renderStatus();napi_value o;napi_create_object(e,&o);num(e,o,"galaxyObserverMode",s.galaxyObserverMode);num(e,o,"galaxyObserverTime",s.galaxyObserverTime);
    auto boolean=[&](const char *key,bool b){napi_value v;napi_get_boolean(e,b,&v);napi_set_named_property(e,o,key,v);};
    napi_value follow,flag,center;napi_create_object(e,&follow);napi_get_boolean(e,s.fragmentFollow.active,&flag);napi_set_named_property(e,follow,"active",flag);napi_get_boolean(e,s.fragmentFollow.moving,&flag);napi_set_named_property(e,follow,"moving",flag);
    num(e,follow,"seed",s.fragmentFollow.seed);num(e,follow,"anchor",s.fragmentFollow.anchor);num(e,follow,"rank",s.fragmentFollow.rank);num(e,follow,"count",s.fragmentFollow.count);num(e,follow,"sceneRevision",s.fragmentFollow.sceneRevision);num(e,follow,"time",s.fragmentFollow.time);
    napi_create_array_with_length(e,3,&center);for(int k=0;k<3;k++){napi_value v;napi_create_double(e,s.fragmentFollow.centerKm[k],&v);napi_set_element(e,center,k,v);}napi_set_named_property(e,follow,"centerKm",center);napi_set_named_property(e,o,"fragmentFollow",follow);
    num(e,o,"surfacePending",s.surfacePending);num(e,o,"surfaceGenerated",s.surfaceGenerated);str(e,o,"surfaceError",s.surfaceError);
    boolean("moonReady",s.moonReady);num(e,o,"moonUploads",s.moonUploads);num(e,o,"moonBlend",s.moonBlend);str(e,o,"moonError",s.moonError);
    num(e,o,"materialExposure",s.materialExposure);boolean("materialOcean",s.materialOcean);boolean("materialCloudShadows",s.materialCloudShadows);
    num(e,o,"compositionX",s.compositionX);num(e,o,"compositionY",s.compositionY);num(e,o,"compositionScale",s.compositionScale);num(e,o,"sceneRevision",s.sceneRevision);num(e,o,"surfaceStarts",s.surfaceStarts);boolean("cameraMoving",s.cameraMoving);num(e,o,"centerX",s.centerX);num(e,o,"centerY",s.centerY);num(e,o,"centerZ",s.centerZ);
    boolean("panoramaReady",s.panoramaReady);num(e,o,"panoramaBlend",s.panoramaBlend);boolean("skyReady",s.skyReady);num(e,o,"skyStars",s.skyStars);num(e,o,"skyGalaxy",s.skyGalaxy);
    boolean("ready",s.ready);boolean("texturesReady",s.texturesReady);boolean("active",s.active);
    num(e,o,"frames",s.frames);num(e,o,"submitMs",s.submitMs);num(e,o,"previewSeconds",s.previewSeconds);str(e,o,"error",s.error);return o;
}
napi_value placement(napi_env e,napi_callback_info i){try{
    auto a=optionalArgs(e,i,4,2);bool array=false;napi_is_array(e,a[0],&array);uint32_t n=0;
    if(!array||napi_get_array_length(e,a[0],&n)!=napi_ok||n>8||(n>0&&n<2))throw std::invalid_argument("Invalid preview bodies");
    int candidate=integer(e,a[1]);if(candidate< -1||candidate>=int(n)||candidate==0)throw std::invalid_argument("Invalid preview candidate");
    std::vector<lab::OrbitSpec> bodies;
    for(uint32_t k=0;k<n;++k){napi_value b;napi_get_element(e,a[0],k,&b);
        auto f=[&](const char* key){napi_value v;napi_get_named_property(e,b,key,&v);return number(e,v);};
        double style=f("surface");lab::OrbitSpec s{"preview",f("massSolar"),f("xAU"),f("yAU"),f("zAU"),f("vxKmS"),f("vyKmS"),f("vzKmS"),int(style)};
        if(s.massSolar<=0||s.massSolar>10||std::abs(s.xAU)>1.e7||std::abs(s.yAU)>1.e7||std::abs(s.zAU)>1.e7||std::hypot(s.vxKmS,std::hypot(s.vyKmS,s.vzKmS))>1.e7||style<0||style>5||std::trunc(style)!=style)throw std::invalid_argument("Invalid preview body");
        bodies.push_back(s);
    }
    int parent=0;double extent=0;napi_valuetype type;napi_typeof(e,a[2],&type);if(type!=napi_undefined)parent=integer(e,a[2]);napi_typeof(e,a[3],&type);if(type!=napi_undefined)extent=number(e,a[3]);
    if(parent<0||(!bodies.empty()&&parent>=int(bodies.size()))||extent<0||extent>100||(parent>0&&extent<.000001))throw std::invalid_argument("Invalid placement parent or extent");
    lab::setOrbitPlacement(bodies,candidate,parent,extent);return undef(e);
    }catch(const std::exception& ex){return fail(e,ex);}}
napi_value placementAt(napi_env e,napi_callback_info i){try{
    auto a=args(e,i,3);auto p=lab::placeOrbitAt(number(e,a[0]),number(e,a[1]),number(e,a[2]));napi_value o;napi_create_array_with_length(e,2,&o);
    for(int k=0;k<2;++k){napi_value v;napi_create_double(e,p[k],&v);napi_set_element(e,o,k,v);}return o;
    }catch(const std::exception& ex){return fail(e,ex);}}
napi_value projection(napi_env e,napi_callback_info){
    auto s=lab::projectedScene();napi_value o,list,v;napi_create_object(e,&o);
    napi_get_boolean(e,s.ready,&v);napi_set_named_property(e,o,"ready",v);
    napi_get_boolean(e,s.placement,&v);napi_set_named_property(e,o,"placement",v);num(e,o,"candidate",s.candidate);
    num(e,o,"widthPx",s.width);num(e,o,"heightPx",s.height);num(e,o,"time",s.time);
    napi_create_array_with_length(e,s.bodies.size(),&list);
    for(size_t i=0;i<s.bodies.size();++i){const auto &b=s.bodies[i];napi_value v;napi_create_object(e,&v);
        num(e,v,"id",b.id);num(e,v,"x",b.x);num(e,v,"y",b.y);num(e,v,"radius",b.radius);num(e,v,"depth",b.depth);num(e,v,"opacity",b.opacity);napi_set_element(e,list,i,v);}
    napi_set_named_property(e,o,"bodies",list);return o;
}
napi_value pick(napi_env e,napi_callback_info i){try{auto a=args(e,i,3);float x=number(e,a[0]),y=number(e,a[1]),padding=number(e,a[2]);
    if(x<0||x>1||y<0||y>1||padding<0||padding>.05f)throw std::invalid_argument("Invalid viewport coordinates or padding");
    auto s=lab::projectedScene();if(!s.ready)throw std::runtime_error("Orbital viewport is not ready");
    napi_value v;napi_create_int32(e,lab::pickProjected(s.bodies,x,y,float(s.width)/s.height,padding),&v);return v;
    }catch(const std::exception &ex){return fail(e,ex);}
}
napi_value observation(napi_env e, napi_callback_info i) {
    try {
        auto a=args(e,i,1);const auto data=lab::Engine::instance().observation(integer(e,a[0]));
        napi_value o,list;napi_create_object(e,&o);napi_create_array_with_length(e,data.samples.size(),&list);
        num(e,o,"sceneRevision",data.sceneRevision);num(e,o,"body",data.body);num(e,o,"selected",data.selected);str(e,o,"name",data.name);
        for(size_t k=0;k<data.samples.size();++k){const auto &p=data.samples[k];napi_value v;napi_create_object(e,&v);
            num(e,v,"frame",p.frame);num(e,v,"time",p.time);num(e,v,"distanceAU",p.distanceAU);num(e,v,"speedKmS",p.speedKmS);napi_set_element(e,list,k,v);}
        napi_set_named_property(e,o,"samples",list);return o;
    }catch(const std::exception &ex){return fail(e,ex);}
}
napi_value galaxyObservation(napi_env e,napi_callback_info){try{
    const auto data=lab::Engine::instance().galaxyObservation();napi_value o,list,flag;napi_create_object(e,&o);napi_get_boolean(e,data.available,&flag);napi_set_named_property(e,o,"available",flag);
    num(e,o,"sceneRevision",data.sceneRevision);num(e,o,"selected",data.selected);napi_create_array_with_length(e,data.samples.size(),&list);
    if(data.available){const auto& c=data.config;napi_value p;napi_create_object(e,&p);num(e,p,"count",c.count);num(e,p,"seed",c.seed);num(e,p,"speed",c.speed);num(e,p,"inclination",c.angle);num(e,p,"duration",c.duration);num(e,p,"massRatio",c.galaxyMassRatio);num(e,p,"offset",c.galaxyOffsetKpc);napi_get_boolean(e,c.galaxyRetrograde,&flag);napi_set_named_property(e,p,"retrograde",flag);if(c.galaxyResponsive){napi_get_boolean(e,true,&flag);napi_set_named_property(e,p,"responsive",flag);}napi_set_named_property(e,o,"parameters",p);}
    for(size_t i=0;i<data.samples.size();i++){const auto& s=data.samples[i];napi_value p,values;napi_create_object(e,&p);num(e,p,"frame",s.frame);num(e,p,"time",s.time);num(e,p,"energyError",s.energyError);num(e,p,"angularError",s.angularError);napi_create_array_with_length(e,5,&values);for(int k=0;k<5;k++){napi_value v;napi_create_double(e,s.values[k],&v);napi_set_element(e,values,k,v);}napi_set_named_property(e,p,"values",values);napi_set_element(e,list,i,p);}
    napi_set_named_property(e,o,"samples",list);return o;
}catch(const std::exception& ex){return fail(e,ex);}}
napi_value seekGalaxyObservation(napi_env e,napi_callback_info i){try{auto a=args(e,i,3);lab::Engine::instance().seekGalaxyObservation(integer(e,a[0]),integer(e,a[1]),number(e,a[2]));return undef(e);}catch(const std::exception& ex){return fail(e,ex);}}
napi_value setGalaxyObserver(napi_env e,napi_callback_info i){try{auto a=args(e,i,6);lab::setGalaxyObserver(integer(e,a[0]),number(e,a[1]),number(e,a[2]),number(e,a[3]),number(e,a[4]),number(e,a[5]));return undef(e);}catch(const std::exception& ex){return fail(e,ex);}}
napi_value galaxyObserverStatus(napi_env e,napi_callback_info){try{const auto s=lab::galaxyObserverStatus();napi_value o,flag;napi_create_object(e,&o);napi_get_boolean(e,s.available,&flag);napi_set_named_property(e,o,"available",flag);
    num(e,o,"mode",s.mode);num(e,o,"sceneRevision",s.sceneRevision);num(e,o,"selected",s.selected);num(e,o,"time",s.time);num(e,o,"anchor",s.anchor);num(e,o,"initialRadiusKpc",s.initialRadiusKpc);num(e,o,"yaw",s.settings.yaw);num(e,o,"pitch",s.settings.pitch);num(e,o,"fov",s.settings.fov);const auto primaryAim=lab::galaxyObserverAim(s,false),secondaryAim=lab::galaxyObserverAim(s,true);num(e,o,"primaryYaw",primaryAim[0]);num(e,o,"primaryPitch",primaryAim[1]);num(e,o,"secondaryYaw",secondaryAim[0]);num(e,o,"secondaryPitch",secondaryAim[1]);num(e,o,"latitude",s.settings.latitude);num(e,o,"siderealHours",s.settings.siderealHours);
    const char* names[]={"positionKpc","primaryDirection","secondaryDirection"};const lab::GalaxyVector vectors[]={s.positionKpc,s.primaryDirection,s.secondaryDirection};
    for(int k=0;k<3;k++){napi_value a;napi_create_array_with_length(e,3,&a);for(int j=0;j<3;j++){napi_value v;napi_create_double(e,vectors[k][j],&v);napi_set_element(e,a,j,v);}napi_set_named_property(e,o,names[k],a);}
    str(e,o,"scope","solar-radius tracer analogue; equal-weight illustrative sky; frozen J2000 analogue horizon with independent local sidereal time, not future Earth astrometry or calibrated Milky Way/Andromeda forecast");return o;
}catch(const std::exception& ex){return fail(e,ex);}}
napi_value galaxyPlacement(napi_env e,napi_callback_info i){try{auto a=args(e,i,9);bool on,retro,responsive;
    if(napi_get_value_bool(e,a[0],&on)!=napi_ok||napi_get_value_bool(e,a[7],&retro)!=napi_ok||napi_get_value_bool(e,a[8],&responsive)!=napi_ok)throw std::invalid_argument("Boolean expected");
    lab::setGalaxyPlacement(on,{integer(e,a[1]),integer(e,a[2]),number(e,a[3]),number(e,a[4]),number(e,a[5]),number(e,a[6]),retro,responsive});return undef(e);
}catch(const std::exception& ex){return fail(e,ex);}}
napi_value galaxyPlacementAt(napi_env e,napi_callback_info i){try{auto a=args(e,i,2);napi_value v;napi_create_double(e,lab::placeGalaxyAt(number(e,a[0]),number(e,a[1])),&v);return v;}catch(const std::exception& ex){return fail(e,ex);}}
napi_value sphObservation(napi_env e,napi_callback_info) {
    try{const auto data=lab::Engine::instance().sphObservation();napi_value o,list;napi_create_object(e,&o);napi_create_array_with_length(e,data.samples.size(),&list);
        num(e,o,"sceneRevision",data.sceneRevision);num(e,o,"selected",data.selected);
        for(size_t k=0;k<data.samples.size();++k){const auto &p=data.samples[k];napi_value v,values;napi_create_object(e,&v);napi_create_array_with_length(e,10,&values);
            num(e,v,"frame",p.frame);num(e,v,"time",p.time);for(size_t j=0;j<10;++j){napi_value n;napi_create_double(e,p.values[j],&n);napi_set_element(e,values,j,n);}napi_set_named_property(e,v,"values",values);
            if(p.structure.available){napi_value a;napi_create_array_with_length(e,4,&a);for(size_t j=0;j<4;j++){napi_value n;napi_create_double(e,p.structure.values[j],&n);napi_set_element(e,a,j,n);}napi_set_named_property(e,v,"structure",a);}
            napi_set_element(e,list,k,v);}
        napi_set_named_property(e,o,"samples",list);return o;
    }catch(const std::exception &ex){return fail(e,ex);}
}
napi_value sphFragments(napi_env e,napi_callback_info i){
    try{auto args2=args(e,i,2);int offset=integer(e,args2[0]),limit=integer(e,args2[1]);if(offset<0||offset>10000||limit<1||limit>32)throw std::invalid_argument("Invalid fragment page");
        const auto snapshot=lab::Engine::instance().fragmentFrame();const auto frame=snapshot.frame;napi_value o,list,available;napi_create_object(e,&o);
        num(e,o,"sceneRevision",snapshot.sceneRevision);num(e,o,"selected",snapshot.selected);num(e,o,"time",frame?frame->time:0);num(e,o,"linkScale",lab::fragmentLinkScale);num(e,o,"offset",offset);str(e,o,"method","symmetric-smoothing-connectivity-v1");
        bool valid=frame&&frame->fragments.available;napi_get_boolean(e,valid,&available);napi_set_named_property(e,o,"available",available);
        if(!valid){napi_create_array(e,&list);napi_set_named_property(e,o,"groups",list);str(e,o,"reason","此记录没有材料团块数据，重新计算后可查看");return o;}
        const auto& data=frame->fragments;const size_t end=std::min(data.groups.size(),size_t(offset+limit)),begin=std::min(data.groups.size(),size_t(offset));napi_create_array_with_length(e,end-begin,&list);
        size_t singletons=0;double singletonMass=0;for(const auto&g:data.groups)if(g.count==1){singletons++;singletonMass+=g.mass;}
        num(e,o,"groupCount",data.groups.size());num(e,o,"particleCount",data.labels.size());num(e,o,"totalMassKg",frame->totalMass);num(e,o,"singletonCount",singletons);num(e,o,"singletonMassKg",singletonMass);num(e,o,"largestMassFraction",data.groups[0].mass/frame->totalMass);num(e,o,"nextOffset",end<data.groups.size()?int(end):-1);str(e,o,"reason","");
        for(size_t k=begin;k<end;k++){const auto&g=data.groups[k];napi_value item,center,velocity;napi_create_object(e,&item);napi_create_array_with_length(e,3,&center);napi_create_array_with_length(e,3,&velocity);
            num(e,item,"rank",k+1);num(e,item,"anchor",g.anchor);num(e,item,"count",g.count);num(e,item,"massKg",g.mass);num(e,item,"massFraction",g.mass/frame->totalMass);num(e,item,"rmsRadiusKm",g.rmsRadius/1000);
            for(int q=0;q<3;q++){napi_value p,v;napi_create_double(e,g.center[q]/1000,&p);napi_create_double(e,g.velocity[q]/1000,&v);napi_set_element(e,center,q,p);napi_set_element(e,velocity,q,v);}napi_set_named_property(e,item,"centerKm",center);napi_set_named_property(e,item,"velocityKmS",velocity);napi_set_element(e,list,k-begin,item);}
        napi_set_named_property(e,o,"groups",list);return o;
    }catch(const std::exception&ex){return fail(e,ex);}
}
napi_value seekSphObservation(napi_env e,napi_callback_info i) {
    try{auto a=args(e,i,3);const int revision=integer(e,a[1]);if(revision<0)throw std::invalid_argument("Invalid revision");lab::Engine::instance().seekSphObservation(integer(e,a[0]),uint64_t(revision),number(e,a[2]));}catch(const std::exception &ex){return fail(e,ex);}return undef(e);
}
napi_value seekObservation(napi_env e, napi_callback_info i) {
    try {auto a=args(e,i,3);const int revision=integer(e,a[1]);if(revision<0)throw std::invalid_argument("Invalid revision");
        lab::Engine::instance().seekObservation(integer(e,a[0]),uint64_t(revision),number(e,a[2]));
    }catch(const std::exception &ex){return fail(e,ex);}return undef(e);
}
napi_value status(napi_env e, napi_callback_info) {
    auto s = lab::Engine::instance().status();
    napi_value o;
    napi_create_object(e, &o);
    str(e, o, "state", s.state);
    str(e, o, "error", s.error);
    napi_value prep,slow,events;napi_create_object(e,&prep);
    num(e,prep,"requestId",s.preparation.requestId);str(e,prep,"stage",s.preparation.stage);
    num(e,prep,"elapsedMs",s.preparation.elapsedMs);num(e,prep,"stageMs",s.preparation.stageMs);
    num(e,prep,"previousRequestId",s.preparation.previousRequestId);str(e,prep,"previousStage",s.preparation.previousStage);
    napi_get_boolean(e,s.preparation.slow,&slow);napi_set_named_property(e,prep,"slow",slow);
    napi_create_array_with_length(e,s.preparation.events.size(),&events);
    for(size_t k=0;k<s.preparation.events.size();++k){napi_value event;napi_create_object(e,&event);str(e,event,"stage",s.preparation.events[k].stage);num(e,event,"elapsedMs",s.preparation.events[k].elapsedMs);napi_set_element(e,events,k,event);}
    napi_set_named_property(e,prep,"events",events);napi_set_named_property(e,o,"preparation",prep);
    num(e, o, "count", s.count);
    num(e, o, "frames", s.frames);
    num(e, o, "selected", s.selected);
    num(e, o, "time", s.time);
    num(e, o, "duration", s.duration);
    napi_value clockFlag;napi_get_boolean(e,s.continuous,&clockFlag);napi_set_named_property(e,o,"continuous",clockFlag);num(e,o,"daysPerSecond",s.daysPerSecond);num(e,o,"actualDaysPerSecond",s.actualDaysPerSecond);num(e,o,"orbitRevision",s.orbitRevision);
    napi_value exact;napi_create_array_with_length(e,s.orbitState.size(),&exact);for(size_t i=0;i<s.orbitState.size();i++)napi_set_element(e,exact,i,orbitValue(e,s.orbitState[i]));napi_set_named_property(e,o,"orbitState",exact);
    num(e, o, "stepMs", s.stepMs);
    num(e, o, "steps", s.steps);
    num(e, o, "maxSpeed", s.maxSpeed);
    num(e, o, "meanDensity", s.meanDensity);
    num(e,o,"totalMass",s.totalMass);
    napi_value diag,available;napi_create_object(e,&diag);napi_get_boolean(e,s.sph.available,&available);napi_set_named_property(e,diag,"available",available);
    const char *keys[]={"pressureMinGPa","pressureMaxGPa","pressureMeanGPa","internalMinMJkg","internalMaxMJkg","internalMeanMJkg","damageMean","damageMax","kineticJ","internalJ"};
    if(s.sph.available)for(int k=0;k<10;++k)num(e,diag,keys[k],s.sph.values[k]);
    if(s.sph.structure.available){napi_value a;napi_create_array_with_length(e,4,&a);for(size_t j=0;j<4;j++){napi_value n;napi_create_double(e,s.sph.structure.values[j],&n);napi_set_element(e,a,j,n);}napi_set_named_property(e,diag,"structure",a);}
    if(s.sph.response.available){napi_value response;napi_create_object(e,&response);
        const char* keys[]={"softeningMean","zeroShearMassFraction","damagedMassFraction","strengthMean"};
        for(int k=0;k<4;k++)num(e,response,keys[k],s.sph.response.values[k]);
        str(e,response,"model","basalt-von-mises-response-v1");num(e,response,"meltEnergyMJkg",lab::ROCK_MELT_ENERGY_JKG/1e6);num(e,response,"intactYieldGPa",lab::ROCK_YIELD_PA/1e9);
        napi_set_named_property(e,diag,"response",response);}
    napi_set_named_property(e,o,"sph",diag);
    num(e,o,"energyError",s.energyError);num(e,o,"angularError",s.angularError);
    str(e,o,"model",s.config.impactContact.hasIncoming?(s.config.impactTides?"sph-orbit-impact-tides-v1":"sph-orbit-impact-v1"):s.config.preset==6?(s.config.galaxyResponsive?"galaxy-responsive-v1":"galaxy-tidal-restricted-v1"):s.config.preset==5?(!s.config.orbitBodies.empty()&&s.config.orbitBodies[0].radiusKm>0?"nbody-hard-sphere-v1":"nbody-custom-v1"):(s.config.preset>=3?"nbody-v1":(s.config.relaxationSeconds>0?"sph-rock-prepared-v1":(s.config.selfGravity?"sph-rock-gravity-v1":"sph-rock-v1"))));
    if(s.config.impactContact.hasIncoming||(s.config.preset==5&&!s.config.orbitBodies.empty()&&s.config.orbitBodies[0].radiusKm>0)){
        napi_value contact;napi_create_object(e,&contact);num(e,contact,"count",s.contact.count);num(e,contact,"a",s.contact.a);num(e,contact,"b",s.contact.b);num(e,contact,"timeSeconds",s.contact.time*lab::YEAR);num(e,contact,"normalSpeedKmS",s.contact.speed*lab::AU/lab::YEAR/1000);num(e,contact,"restitution",1);
        const auto plan=lab::makeImpactPlan(s.contact);napi_value incoming,flag;napi_create_object(e,&incoming);
        napi_get_boolean(e,plan.available,&flag);napi_set_named_property(e,incoming,"available",flag);
        napi_get_boolean(e,plan.supported,&flag);napi_set_named_property(e,incoming,"withinCurrentBounds",flag);
        str(e,incoming,"reason",plan.reason);str(e,incoming,"model","orbital-incoming-com-v1");
        str(e,incoming,"velocityConvention","kick-drift-kick incoming half-step");
        if(plan.available){
            num(e,incoming,"timeSeconds",plan.timeSeconds);num(e,incoming,"relativeSpeedKmS",plan.relativeSpeedKmS);num(e,incoming,"contactAngleDegrees",plan.contactAngleDegrees);num(e,incoming,"kineticEnergyJ",plan.kineticEnergyJ);
            auto vec=[&](napi_value object,const char* key,const lab::Vec3& values){napi_value array;napi_create_array_with_length(e,3,&array);for(int k=0;k<3;k++){napi_value number;napi_create_double(e,values[k],&number);napi_set_element(e,array,k,number);}napi_set_named_property(e,object,key,array);};
            vec(incoming,"originAU",plan.originAU);vec(incoming,"velocityKmS",plan.velocityKmS);vec(incoming,"angularMomentumKgM2S",plan.angularMomentum);
            napi_value bodies;napi_create_array_with_length(e,2,&bodies);for(int i=0;i<2;i++){const auto& body=plan.bodies[i];napi_value item;napi_create_object(e,&item);num(e,item,"id",i==0?s.contact.a:s.contact.b);num(e,item,"massKg",body.massKg);num(e,item,"radiusKm",body.radiusKm);num(e,item,"densityKgM3",body.densityKgM3);vec(item,"positionM",body.positionM);vec(item,"velocityMS",body.velocityMS);napi_set_element(e,bodies,i,item);}napi_set_named_property(e,incoming,"bodies",bodies);
        }
        const auto field=lab::makeImpactTides(s.contact);napi_value tide;napi_create_object(e,&tide);
        napi_get_boolean(e,field.available,&flag);napi_set_named_property(e,tide,"available",flag);str(e,tide,"reason",field.reason);num(e,tide,"sourceCount",field.sources);num(e,tide,"radiusLimitKm",field.radiusLimitM/1000);num(e,tide,"motionRatio",field.motionRatio);
        napi_value tensor;napi_create_array_with_length(e,9,&tensor);for(int k=0;k<9;k++){napi_value v;napi_create_double(e,field.tensor[k],&v);napi_set_element(e,tensor,k,v);}napi_set_named_property(e,tide,"tensorS2",tensor);napi_set_named_property(e,contact,"tides",tide);
        napi_set_named_property(e,contact,"incoming",incoming);napi_set_named_property(e,o,"contact",contact);
    }
    if(s.impactReturnAvailable||s.config.impactContact.hasIncoming){napi_value impact,flag;napi_create_object(e,&impact);
        napi_get_boolean(e,s.config.impactContact.hasIncoming,&flag);napi_set_named_property(e,impact,"local",flag);napi_get_boolean(e,s.impactReturnAvailable,&flag);napi_set_named_property(e,impact,"canReturn",flag);napi_get_boolean(e,s.impactPreparing,&flag);napi_set_named_property(e,impact,"preparing",flag);
        num(e,impact,"sourceTimeSeconds",s.config.impactContact.time*lab::YEAR);num(e,impact,"eventCount",s.config.impactContact.count);num(e,impact,"a",s.config.impactContact.a);num(e,impact,"b",s.config.impactContact.b);napi_get_boolean(e,s.config.impactTides,&flag);napi_set_named_property(e,impact,"tides",flag);
        num(e,impact,"elapsedSeconds",s.time);num(e,impact,"eventEpochPlusElapsedSeconds",s.config.impactContact.time*lab::YEAR+s.time);num(e,impact,"tidalPotentialJ",s.tidalPotentialJ);
        if(s.sph.available&&s.sph.structure.available)num(e,impact,"trackedEnergyJ",s.sph.values[8]+s.sph.values[9]+s.sph.structure.values[0]+s.tidalPotentialJ);
        str(e,impact,"energyScope","kinetic + internal + softened self gravity + frozen tide; excludes elastic strain energy and parent world");
        str(e,impact,"assumptions",s.config.impactTides?"cold basalt, zero spin, self gravity plus frozen linear external tide; world paused, no reciprocal response or remnant reinsertion":"isolated cold basalt, zero spin, self gravity; world paused; no remnant reinsertion");napi_set_named_property(e,o,"impact",impact);}
    str(e,o,"timeUnit",s.config.preset==6?"Myr":s.config.preset>=3?"year":"s");
    if(s.galaxy.available){napi_value g;napi_create_object(e,&g);const char* keys[]={"separationKpc","primaryRmsKpc","secondaryRmsKpc","primaryOuterFraction","secondaryOuterFraction"};
        for(int k=0;k<5;k++)num(e,g,keys[k],s.galaxy.values[k]);str(e,g,"energyScope",s.config.galaxyResponsive?"closed system: massive stellar populations and two responsive extended cores":"two softened centers only; tracers exchange energy with the time-dependent field");str(e,g,"outerScope","fraction of origin tracers beyond 1.5 initial outer radii; not unbound mass");napi_set_named_property(e,o,"galaxy",g);}

    napi_value bodies;napi_create_array_with_length(e,s.bodies.size(),&bodies);
    const char *names[]={"恒星","蓝色行星","金色行星","红色行星"};
    for(size_t i=0;i<s.bodies.size();++i){const auto &p=s.bodies[i];napi_value b;napi_create_object(e,&b);
        str(e,b,"name",!s.orbitState.empty()?s.orbitState[i].name:(s.config.preset==5?s.config.orbitBodies[i].name:names[i]));num(e,b,"surface",!s.orbitState.empty()?s.orbitState[i].surface:(s.config.preset==5?s.config.orbitBodies[i].surface:int(i)));num(e,b,"id",i);num(e,b,"xAU",p.x);num(e,b,"yAU",p.y);num(e,b,"zAU",p.z);
        if(s.config.preset==5&&s.config.orbitBodies[i].radiusKm>0)num(e,b,"radiusKm",s.config.orbitBodies[i].radiusKm);num(e,b,"speedKmS",p.speed);num(e,b,"massSolar",p.density);napi_set_element(e,bodies,i,b);}
    napi_set_named_property(e,o,"bodies",bodies);
    if (s.configKnown) {
      napi_value c; napi_create_object(e,&c);
      if(s.config.preset==6){num(e,c,"galaxyMassRatio",s.config.galaxyMassRatio);num(e,c,"galaxyOffsetKpc",s.config.galaxyOffsetKpc);napi_value retro;napi_get_boolean(e,s.config.galaxyRetrograde,&retro);napi_set_named_property(e,c,"galaxyRetrograde",retro);if(s.config.galaxyResponsive){napi_get_boolean(e,true,&retro);napi_set_named_property(e,c,"galaxyResponsive",retro);}}
      num(e,c,"preset",s.config.preset);num(e,c,"count",s.config.count);num(e,c,"speed",s.config.speed);
      num(e,c,"angle",s.config.angle);num(e,c,"duration",s.config.duration);
      num(e,c,"targetRadiusKm",s.config.targetRadiusKm);num(e,c,"impactorRadiusKm",s.config.impactorRadiusKm);
      num(e,c,"targetDensity",s.config.targetDensity);num(e,c,"impactorDensity",s.config.impactorDensity);
      if(s.config.initialEnergyMJkg>0)num(e,c,"initialEnergyMJkg",s.config.initialEnergyMJkg);
      if(s.config.initialDamage>0)num(e,c,"initialDamage",s.config.initialDamage);
      if(s.config.relaxationSeconds>0)num(e,c,"relaxationSeconds",s.config.relaxationSeconds);
      if(s.config.selfGravity){napi_value g;napi_get_boolean(e,true,&g);napi_set_named_property(e,c,"selfGravity",g);}
      if(s.config.impactContact.hasIncoming){napi_value flag;napi_get_boolean(e,true,&flag);napi_set_named_property(e,c,"impactLocal",flag);napi_get_boolean(e,s.config.impactTides,&flag);napi_set_named_property(e,c,"impactTides",flag);}
      num(e,c,"targetSpin",s.config.targetSpin);num(e,c,"seed",s.config.seed);
      if(s.config.preset==5){napi_value list;napi_create_array_with_length(e,s.config.orbitBodies.size(),&list);
        for(size_t i=0;i<s.config.orbitBodies.size();++i){const auto &b=s.config.orbitBodies[i];napi_value v;napi_create_object(e,&v);
          str(e,v,"name",b.name);num(e,v,"massSolar",b.massSolar);num(e,v,"xAU",b.xAU);num(e,v,"yAU",b.yAU);num(e,v,"zAU",b.zAU);
          num(e,v,"vxKmS",b.vxKmS);num(e,v,"vyKmS",b.vyKmS);num(e,v,"vzKmS",b.vzKmS);num(e,v,"surface",b.surface);if(b.radiusKm>0)num(e,v,"radiusKm",b.radiusKm);napi_set_element(e,list,i,v);}
        napi_set_named_property(e,c,"orbitBodies",list);}
      napi_set_named_property(e,o,"config",c);
    }
    return o;
}
struct IoWork {
    napi_async_work work = nullptr;
    napi_deferred deferred;
    std::string dir;
    bool load = false, ok = false;
};
void execute(napi_env, void *data) {
    auto w = static_cast<IoWork *>(data);
    try {
        w->ok =
            w->load ? lab::Engine::instance().loadReplay(w->dir) : lab::Engine::instance().saveReplay(w->dir);
    } catch (...) {
        w->ok = false;
    }
}
void complete(napi_env env, napi_status status, void *data) {
    auto w = static_cast<IoWork *>(data);
    napi_value v;
    napi_get_boolean(env, w->ok && status == napi_ok, &v);
    napi_resolve_deferred(env, w->deferred, v);
    napi_delete_async_work(env, w->work);
    delete w;
}
napi_value io(napi_env e, napi_callback_info i, bool load) {
    try {
        auto a = args(e, i, 1);
        size_t len = 0;
        if (napi_get_value_string_utf8(e, a[0], nullptr, 0, &len) != napi_ok || len == 0 || len > 4096)
            throw std::invalid_argument("Invalid app directory");
        std::string dir(len + 1, '\0');
        napi_get_value_string_utf8(e, a[0], &dir[0], len + 1, &len);
        dir.resize(len);
        auto w = new IoWork();
        w->dir = dir;
        w->load = load;
        napi_value promise, name;
        napi_create_promise(e, &w->deferred, &promise);
        napi_create_string_utf8(e, "ReplayIO", NAPI_AUTO_LENGTH, &name);
        if (napi_create_async_work(e, nullptr, name, execute, complete, w, &w->work) != napi_ok) {
            delete w;
            throw std::runtime_error("Unable to create replay task");
        }
        if (napi_queue_async_work(e, w->work) != napi_ok) {
            napi_delete_async_work(e, w->work);
            delete w;
            throw std::runtime_error("Unable to queue replay task");
        }
        return promise;
    } catch (const std::exception &ex) {
        return fail(e, ex);
    }
}
napi_value save(napi_env e, napi_callback_info i) { return io(e, i, false); }
napi_value load(napi_env e, napi_callback_info i) { return io(e, i, true); }
napi_value Init(napi_env e, napi_value exports) {
    lab::Engine::instance();
    napi_property_descriptor props[] = {
        {"startImpact",nullptr,startImpact,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"returnImpact",nullptr,returnImpact,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"configureRingTrace",nullptr,configureTrace,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setRingDisturbance",nullptr,traceDisturbance,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setRingParameters",nullptr,traceParameters,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"seekRingTrace",nullptr,seekTrace,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"ringTraceStatus",nullptr,traceStatus,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setSkyPanorama",nullptr,panorama,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setSky",nullptr,sky,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setOrbitPlacement",nullptr,placement,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"placeOrbitAt",nullptr,placementAt,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"projectedScene",nullptr,projection,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"pickBody",nullptr,pick,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setComposition",nullptr,composition,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setMoonTexture",nullptr,moonTexture,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setVideoOutput",nullptr,videoOutput,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"videoOutputStatus",nullptr,videoStatus,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setMaterial",nullptr,material,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setSurfaceSeeds",nullptr,surfaceSeeds,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setAppearance",nullptr,appearance,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setRenderActive",nullptr,renderActive,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"followSphFragment",nullptr,followFragment,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"clearSphFragmentFollow",nullptr,clearFragmentFollow,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"renderStatus",nullptr,renderStatus,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"orbitClock",nullptr,orbitClock,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"freezeOrbit",nullptr,freezeOrbit,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"insertOrbit",nullptr,insertOrbit,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"startScene", nullptr, startScene, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"start", nullptr, start, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"pause", nullptr, pause, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"cancel", nullptr, cancel, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"seek", nullptr, seek, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"setCamera", nullptr, camera, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"navigateCamera", nullptr, navigateCamera, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"getCameraMotion", nullptr, getCameraMotion, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"cancelCameraMotion", nullptr, cancelCameraMotion, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"sphFragments", nullptr, sphFragments, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"galaxyObservation",nullptr,galaxyObservation,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"seekGalaxyObservation",nullptr,seekGalaxyObservation,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setGalaxyObserver",nullptr,setGalaxyObserver,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"galaxyObserverStatus",nullptr,galaxyObserverStatus,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"setGalaxyPlacement",nullptr,galaxyPlacement,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"placeGalaxyAt",nullptr,galaxyPlacementAt,nullptr,nullptr,nullptr,napi_default,nullptr},
        {"sphObservation", nullptr, sphObservation, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"seekSphObservation", nullptr, seekSphObservation, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"orbitObservation", nullptr, observation, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"seekObservation", nullptr, seekObservation, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"status", nullptr, status, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"saveReplay", nullptr, save, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"loadReplay", nullptr, load, nullptr, nullptr, nullptr, napi_default, nullptr}};
    napi_define_properties(e, exports, sizeof(props) / sizeof(props[0]), props);
    bool has = false;
    napi_has_named_property(e, exports, OH_NATIVE_XCOMPONENT_OBJ, &has);
    if (has) {
        napi_value v;
        napi_get_named_property(e, exports, OH_NATIVE_XCOMPONENT_OBJ, &v);
        OH_NativeXComponent *c = nullptr;
        if (napi_unwrap(e, v, reinterpret_cast<void **>(&c)) == napi_ok && c)
            lab::bindSurface(c);
    }
    return exports;
}
static napi_module module = {1, 0, nullptr, Init, "simulation", nullptr, {0}};
} // namespace
extern "C" __attribute__((constructor)) void RegisterSimulation() { napi_module_register(&module); }
