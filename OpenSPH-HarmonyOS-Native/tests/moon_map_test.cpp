#include "moon_map.h"
#include <cassert>
#include <iostream>
int main(){std::vector<uint8_t> bytes(8388608,31);lab::MoonMap good(2048,1024,bytes.data(),bytes.size());bytes[0]=0;assert(good.rgba[0]==31);int rejected=0;
 for(auto length:{size_t(0),size_t(8388607),size_t(8388609)})try{lab::MoonMap bad(2048,1024,bytes.data(),length);}catch(const std::invalid_argument&){rejected++;}
 try{lab::MoonMap bad(1024,2048,bytes.data(),8388608);}catch(const std::invalid_argument&){rejected++;}
 try{lab::MoonMap bad(2048,1024,nullptr,8388608);}catch(const std::invalid_argument&){rejected++;}
 assert(rejected==5);std::cout<<"PASS Moon RGBA ownership, exact bounds, dimensions and null rejection\n";}
