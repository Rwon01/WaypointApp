package com.rwon.maypoints.Controllers;

import com.rwon.maypoints.Entities.Waypoint;
import com.rwon.maypoints.Services.impl.WaypointServiceImpl;
import org.apache.coyote.Response;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Controller
public class HomeController
{
    private final WaypointServiceImpl waypointServiceImpl;

    public HomeController(WaypointServiceImpl waypointServiceImpl) {
        this.waypointServiceImpl = waypointServiceImpl;
    }

    @Value("$spring.application.name")
    private String appName;


    @RequestMapping("/")
    public String index(){
        return "index.html";
    }


}
