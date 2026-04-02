package com.rwon.maypoints.Controllers;

import com.rwon.maypoints.Entities.Waypoint;
import com.rwon.maypoints.Entities.WaypointDto;
import com.rwon.maypoints.Services.impl.WaypointServiceImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/waypoints")
@CrossOrigin(origins = "http://localhost:5173")

public class WaypointController {

    private final WaypointServiceImpl waypointServiceImpl;

    public WaypointController(WaypointServiceImpl waypointServiceImpl) {
        this.waypointServiceImpl = waypointServiceImpl;
    }

    @PostMapping()
    public ResponseEntity<Waypoint> createWaypoint(@RequestBody Waypoint wp){
        var saved = waypointServiceImpl.createWaypoint(wp);
        return ResponseEntity.status(201).body(saved);
    }

    @GetMapping("/{id}")
    public ResponseEntity<WaypointDto> getWaypointById(@PathVariable String id) {
        WaypointDto wp = waypointServiceImpl.getWaypointById(id);
        if (wp == null){return ResponseEntity.notFound().build();}
        return ResponseEntity.ok(wp);
    }

    @GetMapping()
    public ResponseEntity<List<WaypointDto>> getAllWaypoints(){
        List<WaypointDto> allWaypoints = waypointServiceImpl.getAllWaypoints();
        return ResponseEntity.ok(allWaypoints);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteWaypointById(@PathVariable String id){
        waypointServiceImpl.deleteWaypointById(id);
        return ResponseEntity.noContent().build();
    }

}
