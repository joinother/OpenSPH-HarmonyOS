#include "sky_panorama.h"
#include <cassert>
#include <iostream>
int main(){
    std::vector<uint8_t> source(2048*1024*4,127);
    lab::SkyPanorama p(2048,1024,source.data(),source.size());
    source[0]=0;assert(p.rgba[0]==127); // native ownership outlives ArkTS buffer
    for(int scenario=0;scenario<5;scenario++){
        bool rejected=false;
        try{lab::SkyPanorama invalid(scenario==0?-1:2048,scenario==1?4096:1024,
            scenario==2?nullptr:source.data(),scenario==3?source.size()-1:scenario==4?source.size()+1:source.size());}
        catch(const std::invalid_argument&){rejected=true;}
        assert(rejected);
    }
    std::cout<<"PASS panorama: copy ownership; invalid dimensions, null, truncated and oversized buffer rejected\n";
}
