package com.rwon.maypoints.Mappers;

import com.rwon.maypoints.Entities.Waypoint;
import com.rwon.maypoints.Entities.WaypointDto;
import org.mapstruct.Mapper;


@Mapper(componentModel = "spring")
public interface WaypointMapper {
    WaypointDto toDto(Waypoint wp);
    Waypoint fromDto(WaypointDto wp);
}
