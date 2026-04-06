package com.rwon.maypoints.Services;

import com.rwon.maypoints.Entities.Waypoint;
import com.rwon.maypoints.Entities.WaypointDto;

public interface WaypointService {

    Waypoint createWaypoint(Waypoint request);
    WaypointDto getWaypointById(String id);
}
