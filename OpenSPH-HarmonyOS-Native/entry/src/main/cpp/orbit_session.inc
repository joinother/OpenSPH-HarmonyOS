// Included inside namespace lab. v14 stores exact orbital states; v1–13 remain playback-only.
struct OrbitSession {Config config;std::deque<std::shared_ptr<Frame>> frames;bool continuous=false;double rate=1;};
static bool writeOrbitSession(const std::string& dir,const OrbitSession& s) {
    const std::string path=dir+"/last-replay.osphr",temp=path+".tmp";std::ofstream out(temp,std::ios::binary);
    auto write=[&](const auto& x){out.write(reinterpret_cast<const char*>(&x),sizeof(x));};
    uint32_t magic=0x4c485053,version=14,n=s.frames.size(),mode=s.continuous?1:0;write(magic);write(version);write(n);write(mode);write(s.rate);
    const auto& c=s.config;double values[]={double(c.count),c.duration,c.targetRadiusKm,c.impactorRadiusKm,c.targetDensity,c.impactorDensity,c.targetSpin,double(c.seed)};
    for(double x:values)write(x);
    for(const auto& f:s.frames){
        write(f->time);write(f->orbitEnergy);write(f->orbitAngular);write(f->orbitEnergyScale);write(f->orbitAngularScale);write(f->energyError);write(f->angularError);
        write(f->contact.count);int32_t a=f->contact.a,b=f->contact.b;write(a);write(b);write(f->contact.time);write(f->contact.speed);
        uint32_t count=f->orbitState.size();write(count);
        for(const auto& b:f->orbitState){uint32_t length=b.name.size();write(length);out.write(b.name.data(),length);double v[]={b.massSolar,b.xAU,b.yAU,b.zAU,b.vxKmS,b.vyKmS,b.vzKmS,double(b.surface),b.radiusKm};for(double x:v)write(x);}
        uint32_t trails=f->trails.size();write(trails);out.write(reinterpret_cast<const char*>(f->trails.data()),trails*sizeof(Particle));
    }
    out.flush();bool ok=bool(out);out.close();if(!ok){std::remove(temp.c_str());return false;}return std::rename(temp.c_str(),path.c_str())==0;
}
static bool readOrbitSession(std::ifstream& in,OrbitSession& s) {
    in.clear();in.seekg(0);auto read=[&](auto& x){in.read(reinterpret_cast<char*>(&x),sizeof(x));};
    uint32_t magic=0,version=0,n=0,mode=2;read(magic);read(version);read(n);read(mode);read(s.rate);
    if(!in||magic!=0x4c485053||version!=14||n<1||n>240||mode>1||!std::isfinite(s.rate)||s.rate<.001||s.rate>100)return false;
    s.continuous=mode==1;double v[8];for(double& x:v){read(x);if(!in||!std::isfinite(x))return false;}
    if(v[0]<200||v[0]>2400||v[7]<1||v[7]>1000000||v[0]!=std::trunc(v[0])||v[7]!=std::trunc(v[7]))return false;
    Config base;base.preset=3;base.speed=1;base.count=v[0];base.duration=v[1];base.targetRadiusKm=v[2];base.impactorRadiusKm=v[3];base.targetDensity=v[4];base.impactorDensity=v[5];base.targetSpin=v[6];base.seed=v[7];if(!validConfig(base))return false;
    for(uint32_t k=0;k<n;k++){
        auto f=std::make_shared<Frame>();f->orbital=true;
        read(f->time);read(f->orbitEnergy);read(f->orbitAngular);read(f->orbitEnergyScale);read(f->orbitAngularScale);read(f->energyError);read(f->angularError);
        for(double x:{f->time,f->orbitEnergy,f->orbitAngular,f->orbitEnergyScale,f->orbitAngularScale,f->energyError,f->angularError})if(!std::isfinite(x))return false;
        if(f->time<0||f->time>1.e9||f->orbitEnergyScale<=0||f->orbitAngularScale<=0||f->orbitAngular<0||(!s.frames.empty()&&f->time<s.frames.back()->time))return false;
        int32_t a=-1,b=-1;read(f->contact.count);read(a);read(b);f->contact.a=a;f->contact.b=b;read(f->contact.time);read(f->contact.speed);
        uint32_t count=0;read(count);if(!in||count<2||count>8)return false;
        if(f->contact.count>1000000||!std::isfinite(f->contact.time)||!std::isfinite(f->contact.speed)||f->contact.time<0||f->contact.time>f->time+1.e-12||f->contact.speed<0)return false;
        if(f->contact.count==0){if(a!=-1||b!=-1||f->contact.time!=0||f->contact.speed!=0)return false;}else if(a<0||b<=a||b>=int(count)||f->contact.speed<=0)return false;
        std::vector<OrbitBody> bodies;
        for(uint32_t i=0;i<count;i++){
            uint32_t len=0;read(len);if(!in||len<1||len>192)return false;
            std::string name(len,'\0');in.read(&name[0],len);double d[9];for(double& x:d){read(x);if(!in||!std::isfinite(x)||std::abs(x)>1.e7)return false;}
            if(!in||!validOrbitName(name)||d[7]<0||d[7]>5||std::trunc(d[7])!=d[7]||(i==0&&d[7]!=0)||d[0]<(d[7]==0?.1:1.e-8)||d[0]>(d[7]==0?2:.01)||d[8]<0||(d[8]>0&&d[8]<1))return false;
            f->orbitState.push_back({name,d[0],d[1],d[2],d[3],d[4],d[5],d[6],int(d[7]),d[8]});
            bodies.push_back({d[0],{d[1],d[2],d[3]},{d[4]*1000*YEAR/AU,d[5]*1000*YEAR/AU,d[6]*1000*YEAR/AU},d[8]*1000/AU});
            const double speed=norm({d[4],d[5],d[6]});f->particles.push_back({float(d[1]),float(d[2]),float(d[3]),float(speed),float(d[0]),float(i)});f->surfaces.push_back(int(d[7]));if(d[8]>0)f->radiiAU.push_back(d[8]*1000/AU);
            f->maxSpeed=std::max(f->maxSpeed,speed);f->totalMass+=d[0]*SOLAR_MASS;if(i<2)for(int j=0;j<3;j++)f->centers[3*i+j]=d[1+j];
        }
        try{OrbitSystem system(bodies,false);}catch(...){return false;}
        uint32_t trails=0;read(trails);if(!in||trails>count*512)return false;f->trails.resize(trails);in.read(reinterpret_cast<char*>(f->trails.data()),trails*sizeof(Particle));
        for(const auto& p:f->trails)if(!std::isfinite(p.x)||!std::isfinite(p.y)||!std::isfinite(p.z)||!std::isfinite(p.speed)||!std::isfinite(p.density)||!std::isfinite(p.body)||p.body<0||p.body>=count||std::trunc(p.body)!=p.body)return false;
        if(!in)return false;s.frames.push_back(f);
    }
    if(in.peek()!=std::char_traits<char>::eof())return false;
    base.preset=5;base.orbitBodies=s.frames.back()->orbitState;s.config=base;return true;
}
