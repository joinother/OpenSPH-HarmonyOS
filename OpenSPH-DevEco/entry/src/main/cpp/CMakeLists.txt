cmake_minimum_required(VERSION 3.4.1)
project(opensoh_bridge)

# NAPI 桥接库 - 启动 OpenSPH
add_library(opensoh_bridge SHARED
    opensoh_bridge.cpp
)

# OHOS NDK 路径（由 DevEco toolchain 提供）
if(NOT DEFINED OHOS_NDK_HOME AND DEFINED OHOS_SDK_NATIVE)
    set(OHOS_NDK_HOME ${OHOS_SDK_NATIVE})
endif()

target_include_directories(opensoh_bridge PRIVATE
    ${OHOS_NDK_HOME}/sysroot/usr/include
)

target_link_libraries(opensoh_bridge
    ${OHOS_NDK_HOME}/sysroot/usr/lib/aarch64-linux-ohos/libace_napi.z.so
)
