package com.rwon.maypoints.Services.impl;

import com.rwon.maypoints.Entities.Waypoint;
import com.rwon.maypoints.Entities.WaypointDto;
import com.rwon.maypoints.Mappers.WaypointMapper;
import com.rwon.maypoints.Repository.WaypointRepository;
import com.rwon.maypoints.Services.WaypointService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class WaypointServiceImpl implements WaypointService {

    private final WaypointRepository waypointRepository;
    private final WaypointMapper waypointMapper;

    public WaypointServiceImpl(WaypointRepository waypointRepository, WaypointMapper waypointMapper) {
        this.waypointRepository = waypointRepository;
        this.waypointMapper = waypointMapper;
    }


    @Override
    public Waypoint createWaypoint(Waypoint waypoint) {
        Waypoint wp = new Waypoint(null,
                waypoint.getName(),
                waypoint.getX(),
                waypoint.getZ(),
                waypoint.getColor()
        );
        return waypointRepository.save(wp);
    }

    @Override
    public WaypointDto getWaypointById(String id) {
        var wp = waypointMapper.toDto(waypointRepository.findById(id).orElse(null));
        if (wp == null) {
            return null;
        };
        return wp;
    }

    public List<WaypointDto> getAllWaypoints(){
        return waypointRepository.
                findAll().
                stream().
                map(waypointMapper::toDto).
                toList();
    }

    public void deleteWaypointById(String id){
        waypointRepository.deleteById(id);
    }


}
