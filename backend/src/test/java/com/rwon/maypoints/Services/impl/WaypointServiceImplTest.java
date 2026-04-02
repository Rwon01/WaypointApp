package com.rwon.maypoints.Services.impl;
import com.rwon.maypoints.Entities.Waypoint;
import com.rwon.maypoints.Repository.WaypointRepository;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class WaypointServiceImplTest {
    @Mock
    WaypointRepository waypointRepository;
    @InjectMocks
    WaypointServiceImpl waypointService;}

//    @Test
//    public void addWaypointTest() {
//        Waypoint waypoint = new Waypoint();
//        waypoint.setName("Home");
//        waypoint.setX(100);
//        waypoint.setZ(200);
//
//        Mockito.when(waypointRepository.save(waypoint)).thenReturn(waypoint);
//
//        Waypoint savedWaypoint = waypointService.createWaypoint(waypoint);
//
//        // verify interaction
//        Mockito.verify(waypointRepository, Mockito.times(1)).save(waypoint);
//
//        // assertions
//        Assertions.assertEquals(waypoint.getName(), savedWaypoint.getName());
//        Assertions.assertEquals(waypoint.getX(), savedWaypoint.getX());
//        Assertions.assertEquals(waypoint.getZ(), savedWaypoint.getZ());
//    }

//    @Test
//    public void findWaypointByIdShouldReturn(){
//        Waypoint waypoint = new Waypoint();
//        var id = waypoint.getId();
//        waypointRepository.save(waypoint);
//        Waypoint savedWaypoint = waypointRepository.findById(id);
//        Assertions.assertEquals(id, savedWaypoint.getId());
//    }
//}