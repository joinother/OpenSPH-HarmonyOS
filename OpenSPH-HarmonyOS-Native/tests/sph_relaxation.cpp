#include "sph_relaxation.h"
#include "sph_structure.h"
#include <iostream>
#include <iomanip>
using namespace Sph;
static void require(bool ok,const char* why){if(!ok)throw std::runtime_error(why);}
static lab::SphStructure structure(const Storage&s){std::vector<lab::StructureParticle> p;const auto&m=s.getValue<Float>(QuantityId::MASS);const auto&r=s.getValue<Vector>(QuantityId::POSITION);const auto&v=s.getDt<Vector>(QuantityId::POSITION);for(Size i=0;i<m.size();++i)p.push_back({m[i],{r[i][X],r[i][Y],r[i][Z]},{v[i][X],v[i][Y],v[i][Z]}});return lab::measureSphStructure(p,0);}
class MeasuredRelaxation:public lab::SphPreRelaxation {
public:
 using lab::SphPreRelaxation::SphPreRelaxation;
 double sumKinetic=0;int samples=0;
 void onTimeStep(const Storage&s,Statistics& stats)override {lab::SphPreRelaxation::onTimeStep(s,stats);sumKinetic+=structure(s).values[1];++samples;}
};
static Storage sphere(const RunSettings& settings,int count){Storage s;InitialConditions ic(settings);BodySettings b;b.set(BodySettingsId::PARTICLE_COUNT,count);ic.addMonolithicBody(s,SphericalDomain(Vector(0._f),100000._f),b);return s;}
int main(){try{
 auto schedulerLifetime=Factory::getScheduler(RunSettings{});RunSettings settings;lab::configureSphGravity(settings,true);settings.set(RunSettingsId::RUN_RNG_SEED,1234);
 std::cout<<std::setprecision(17);
 for(int count:{200,600})for(double seconds:{16.,64.}){
  auto off=sphere(settings,count),on=sphere(settings,count);const auto initial=structure(on);const auto mass=on.getValue<Float>(QuantityId::MASS).clone();
  MeasuredRelaxation control(settings,seconds,[]{return false;},0),damped(settings,seconds,[]{return false;});control.run(off,control);damped.run(on,damped);
  const auto a=structure(off),b=structure(on);
  require(damped.samples==int(seconds*16)&&control.samples==damped.samples,"incomplete comparison");
  require(damped.sumKinetic<control.sumKinetic,"damping did not reduce time-averaged internal motion");
  require(b.values[2]<initial.values[2]&&b.values[2]>initial.values[2]*.9,"invalid material radius");
  const auto& m=on.getValue<Float>(QuantityId::MASS);for(Size i=0;i<m.size();++i)require(m[i]==mass[i],"particle mass changed");
  std::cout<<"{\"budget\":"<<count<<",\"seconds\":"<<seconds<<",\"count\":"<<m.size()<<",\"initialRadiusKm\":"<<initial.values[2]<<",\"undampedKineticJ\":"<<a.values[1]<<",\"dampedKineticJ\":"<<b.values[1]<<",\"undampedRadialMS\":"<<a.values[3]<<",\"dampedRadialMS\":"<<b.values[3]<<",\"dampedRadiusKm\":"<<b.values[2]<<",\"meanUndampedKineticJ\":"<<control.sumKinetic/control.samples<<",\"meanDampedKineticJ\":"<<damped.sumKinetic/damped.samples<<"}"<<std::endl;
 }
 auto s=sphere(settings,200);const auto rho=s.getValue<Float>(QuantityId::DENSITY).clone();lab::prepareStationaryBody(s,settings,16,[]{return false;});require(structure(s).values[1]==0,"preparation velocity not cleared");
 double changed=0;for(Size i=0;i<rho.size();++i)changed=std::max(changed,std::abs(s.getValue<Float>(QuantityId::DENSITY)[i]-rho[i]));require(changed>0,"evolved density discarded");
 BodyView(s,0).addVelocity(Vector(-5000._f,0._f,0._f));double massTotal=0;for(auto m:s.getValue<Float>(QuantityId::MASS))massTotal+=m;require(structure(s).values[1]/(.5*massTotal*25e6)<1e-24,"uniform boost produced significant internal kinetic energy");
 bool stopped=false;int checks=0;try{auto cancelled=sphere(settings,200);lab::prepareStationaryBody(cancelled,settings,64,[&]{return ++checks>3;});}catch(const std::runtime_error&){stopped=true;}require(stopped&&checks<10,"cooperative cancellation failed");
 std::cout<<"{\"ok\":true,\"cases\":4,\"densityChanged\":"<<changed<<",\"cancellationChecks\":"<<checks<<"}"<<std::endl;return 0;
}catch(const std::exception&e){std::cerr<<"FAIL "<<e.what()<<std::endl;return 1;}}
